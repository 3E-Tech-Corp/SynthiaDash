using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly IProjectService _projectService;
    private readonly IAuthService _authService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(
        IProjectService projectService,
        IAuthService authService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<ProjectsController> logger)
    {
        _projectService = projectService;
        _authService = authService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// List projects — admin sees all, others see only projects they're a member of
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProjects()
    {
        if (IsAdmin())
        {
            var projects = await _projectService.GetProjectsAsync();
            return Ok(projects);
        }
        else
        {
            var userId = GetUserId();
            var projects = await _projectService.GetProjectsForUserAsync(userId);
            return Ok(projects);
        }
    }

    /// <summary>
    /// Get a specific project — admin can see any, others only if they're a member
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetProject(int id)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && !await CanAccessProject(id))
            return NotFound();

        return Ok(project);
    }

    /// <summary>
    /// Update a project (name, description, repo link, domain)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] UpdateProjectRequest request)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        // Admin or project owner can update
        if (!IsAdmin() && !await IsProjectOwner(id))
            return Forbid();

        // Only admin can link/change repos
        if (request.RepoFullName != null && !IsAdmin())
            return Forbid();

        var updated = await _projectService.UpdateProjectAsync(id, request);
        return Ok(updated);
    }

    /// <summary>
    /// Get project slots for current user
    /// </summary>
    [HttpGet("slots")]
    public async Task<IActionResult> GetProjectSlots()
    {
        var userId = GetUserId();
        var email = User.FindFirst("email")?.Value ?? "";
        var userDto = await _authService.GetUserByEmailAsync(email);

        if (userDto == null) return Unauthorized();

        var used = await _projectService.GetProjectCountForUserAsync(userId);
        var max = userDto.Role == "admin" ? 999 : userDto.MaxProjects;

        return Ok(new { used, max, remaining = max - used });
    }

    /// <summary>
    /// Create and provision a new project — any authenticated user, subject to MaxProjects limit
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequest request)
    {
        // Validate slug
        if (string.IsNullOrWhiteSpace(request.Slug) || !Regex.IsMatch(request.Slug, @"^[a-z0-9][a-z0-9\-]*[a-z0-9]$"))
            return BadRequest(new { error = "Slug must be lowercase alphanumeric with hyphens (e.g., 'my-project')" });

        if (string.IsNullOrWhiteSpace(request.Name))
            request.Name = request.Slug;

        if (string.IsNullOrWhiteSpace(request.Domain))
            return BadRequest(new { error = "Domain is required" });

        // Only admin can link existing repos
        if (request.LinkExisting && !IsAdmin())
            return Forbid();

        var userId = GetUserId();
        var email = User.FindFirst("email")?.Value ?? "";

        // Check project limit (admin is unlimited)
        if (!IsAdmin())
        {
            var userDto = await _authService.GetUserByEmailAsync(email);
            if (userDto != null)
            {
                var currentCount = await _projectService.GetProjectCountForUserAsync(userId);
                if (currentCount >= userDto.MaxProjects)
                    return BadRequest(new { error = $"Project limit reached. You can have up to {userDto.MaxProjects} projects." });
            }
        }

        var project = await _projectService.CreateProjectAsync(request, userId, email);

        _logger.LogInformation("Project {Name} ({Slug}) created by {Email} (linkExisting={Link})",
            project.Name, project.Slug, email, request.LinkExisting);

        // Only provision if not linking existing repo
        if (!request.LinkExisting)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _projectService.ProvisionProjectAsync(project);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background provisioning failed for project {Id}", project.Id);
                }
            });
        }

        return Ok(project);
    }

    // ─── Project Members ────────────────────────────────────────

    /// <summary>
    /// List members of a project
    /// </summary>
    [HttpGet("{id}/members")]
    public async Task<IActionResult> GetProjectMembers(int id)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && !await CanAccessProject(id))
            return NotFound();

        var members = await _projectService.GetProjectMembersAsync(id);
        return Ok(members);
    }

    /// <summary>
    /// Add a member to a project (admin or project owner)
    /// </summary>
    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddProjectMember(int id, [FromBody] AddProjectMemberRequest request)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && !await IsProjectOwner(id))
            return Forbid();

        var member = await _projectService.AddProjectMemberAsync(id, request.UserId, request.Role, GetUserId());
        if (member == null)
            return BadRequest(new { error = "User is already a member or invalid role" });

        _logger.LogInformation("Added user {UserId} as {Role} to project {ProjectId}", request.UserId, request.Role, id);
        return Ok(member);
    }

    /// <summary>
    /// Update a member's role (admin or project owner)
    /// </summary>
    [HttpPut("{id}/members/{userId}")]
    public async Task<IActionResult> UpdateProjectMemberRole(int id, int userId, [FromBody] UpdateProjectMemberRequest request)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && !await IsProjectOwner(id))
            return Forbid();

        var success = await _projectService.UpdateProjectMemberRoleAsync(id, userId, request.Role);
        if (!success)
            return NotFound(new { error = "Member not found or invalid role" });

        _logger.LogInformation("Updated user {UserId} role to {Role} in project {ProjectId}", userId, request.Role, id);
        return Ok(new { message = "Role updated" });
    }

    /// <summary>
    /// Remove a member from a project (admin or project owner)
    /// </summary>
    [HttpDelete("{id}/members/{userId}")]
    public async Task<IActionResult> RemoveProjectMember(int id, int userId)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && !await IsProjectOwner(id))
            return Forbid();

        // Don't allow removing the last owner
        var memberRole = await _projectService.GetMemberRoleAsync(id, userId);
        if (memberRole == "owner")
        {
            var members = await _projectService.GetProjectMembersAsync(id);
            var ownerCount = members.Count(m => m.Role == "owner");
            if (ownerCount <= 1)
                return BadRequest(new { error = "Cannot remove the last owner. Transfer ownership first." });
        }

        var success = await _projectService.RemoveProjectMemberAsync(id, userId);
        if (!success)
            return NotFound(new { error = "Member not found" });

        _logger.LogInformation("Removed user {UserId} from project {ProjectId}", userId, id);
        return Ok(new { message = "Member removed" });
    }

    // ─── Existing Endpoints ────────────────────────────────────────

    /// <summary>
    /// Deploy a "Coming Soon" placeholder page for the project
    /// </summary>
    [HttpPost("{id}/deploy-placeholder")]
    public async Task<IActionResult> DeployPlaceholder(int id)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        // Must own the project or be admin
        if (!IsAdmin() && !await IsProjectOwner(id))
            return NotFound();

        if (project.Status != "ready")
            return BadRequest(new { error = "Project must be in 'ready' status to deploy" });

        _logger.LogInformation("Deploying placeholder for project {Id} ({Name})", project.Id, project.Name);

        // Trigger the deploy-placeholder workflow via GitHub API
        try
        {
            var githubToken = _configuration["GitHub:Token"] ?? "";
            var client = _httpClientFactory.CreateClient("GitHub");

            var payload = new
            {
                @ref = "main",
                inputs = new
                {
                    site_name = project.IisSiteName,
                    title = project.Name,
                    description = project.Description ?? "",
                    domain = project.Domain,
                    project_id = project.Id.ToString()
                }
            };

            var content = new System.Net.Http.StringContent(
                System.Text.Json.JsonSerializer.Serialize(payload),
                System.Text.Encoding.UTF8, "application/json");

            // Trigger workflow on SynthiaDash repo (where deploy-placeholder.yml lives)
            var org = _configuration["GitHub:Org"] ?? "3E-Tech-Corp";
            var resp = await client.PostAsync(
                $"repos/{org}/SynthiaDash/actions/workflows/deploy-placeholder.yml/dispatches",
                content);

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                _logger.LogError("Failed to trigger deploy-placeholder: {Status} {Body}", resp.StatusCode, body);
                return StatusCode(500, new { error = "Failed to trigger deployment" });
            }

            // Update project status
            await _projectService.UpdateProjectStatusAsync(project.Id, "ready",
                "Coming Soon page deployed to " + project.Domain);

            return Ok(new { message = "Placeholder deployment triggered", domain = project.Domain });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deploy placeholder failed for project {Id}", id);
            return StatusCode(500, new { error = "Deployment failed: " + ex.Message });
        }
    }

    /// <summary>
    /// Update project status (for callbacks from provisioning workflow)
    /// </summary>
    [HttpPost("{id}/status")]
    [AllowAnonymous] // Called by GitHub Actions
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateProjectStatusRequest request)
    {
        var project = await _projectService.UpdateProjectStatusAsync(id, request.Status, request.Detail, request.Error);
        if (project == null) return NotFound();
        return Ok(project);
    }

    // ─── Helpers ────────────────────────────────────────

    private int GetUserId()
    {
        var userIdStr = User.FindFirst("userId")?.Value;
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }

    private bool IsAdmin()
    {
        return User.IsInRole("admin");
    }

    private async Task<bool> CanAccessProject(int projectId)
    {
        var userId = GetUserId();
        // Check ProjectMembers first, fall back to CreatedByUserId
        if (await _projectService.IsProjectMemberAsync(projectId, userId))
            return true;
        var project = await _projectService.GetProjectAsync(projectId);
        return project?.CreatedByUserId == userId;
    }

    private async Task<bool> IsProjectOwner(int projectId)
    {
        var userId = GetUserId();
        var role = await _projectService.GetMemberRoleAsync(projectId, userId);
        if (role == "owner") return true;
        // Fall back to CreatedByUserId for backwards compat
        var project = await _projectService.GetProjectAsync(projectId);
        return project?.CreatedByUserId == userId;
    }
}

public class UpdateProjectStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Detail { get; set; }
    public string? Error { get; set; }
}
