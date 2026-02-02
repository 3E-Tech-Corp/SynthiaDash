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
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(IProjectService projectService, IAuthService authService, ILogger<ProjectsController> logger)
    {
        _projectService = projectService;
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// List projects — admin sees all, others see only their own
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
    /// Get a specific project — admin can see any, others only their own
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetProject(int id)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();

        if (!IsAdmin() && project.CreatedByUserId != GetUserId())
            return NotFound();

        return Ok(project);
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

        _logger.LogInformation("Project {Name} ({Slug}) created by {Email}", project.Name, project.Slug, email);

        // Provision in background
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

        return Ok(project);
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

    private int GetUserId()
    {
        var userIdStr = User.FindFirst("userId")?.Value;
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }

    private bool IsAdmin()
    {
        return User.IsInRole("admin");
    }
}

public class UpdateProjectStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Detail { get; set; }
    public string? Error { get; set; }
}
