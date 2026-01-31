using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CynthiaDash.Api.Services;

namespace CynthiaDash.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReposController : ControllerBase
{
    private readonly IGitHubService _githubService;
    private readonly IUserScopeService _scopeService;

    public ReposController(IGitHubService githubService, IUserScopeService scopeService)
    {
        _githubService = githubService;
        _scopeService = scopeService;
    }

    /// <summary>
    /// Get repos visible to the current user
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRepos()
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var scope = _scopeService.GetUserScope(email);

        if (scope.Role == "none")
            return Forbid();

        var repos = await _githubService.GetReposAsync(scope.Repos);

        // Enrich with last deploy info
        foreach (var repo in repos)
        {
            repo.LastDeploy = await _githubService.GetLastDeployAsync(repo.FullName);
        }

        return Ok(repos);
    }

    /// <summary>
    /// Get deploy history for a specific repo
    /// </summary>
    [HttpGet("{owner}/{repo}/deploys")]
    public async Task<IActionResult> GetDeploys(string owner, string repo, [FromQuery] int limit = 10)
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var fullName = $"{owner}/{repo}";

        if (!_scopeService.CanAccessRepo(email, repo) && !_scopeService.CanAccessRepo(email, fullName))
            return Forbid();

        var deploys = await _githubService.GetDeployHistoryAsync(fullName, limit);
        return Ok(deploys);
    }

    /// <summary>
    /// Trigger a deploy for a specific repo
    /// </summary>
    [HttpPost("{owner}/{repo}/deploy")]
    public async Task<IActionResult> TriggerDeploy(string owner, string repo)
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var fullName = $"{owner}/{repo}";

        if (!_scopeService.CanAccessRepo(email, repo) && !_scopeService.CanAccessRepo(email, fullName))
            return Forbid();

        var success = await _githubService.TriggerDeployAsync(fullName);

        if (success)
            return Ok(new { message = "Deploy triggered", repo = fullName });

        return BadRequest(new { message = "Failed to trigger deploy. No deploy workflow found or insufficient permissions." });
    }
}
