using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize(Roles = "admin")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectService _projectService;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(IProjectService projectService, ILogger<ProjectsController> logger)
    {
        _projectService = projectService;
        _logger = logger;
    }

    /// <summary>
    /// List all projects
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProjects()
    {
        var projects = await _projectService.GetProjectsAsync();
        return Ok(projects);
    }

    /// <summary>
    /// Get a specific project
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetProject(int id)
    {
        var project = await _projectService.GetProjectAsync(id);
        if (project == null) return NotFound();
        return Ok(project);
    }

    /// <summary>
    /// Create and provision a new project
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
}

public class UpdateProjectStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Detail { get; set; }
    public string? Error { get; set; }
}
