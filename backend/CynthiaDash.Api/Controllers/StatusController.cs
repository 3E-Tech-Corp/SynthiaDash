using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CynthiaDash.Api.Services;

namespace CynthiaDash.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatusController : ControllerBase
{
    private readonly IGatewayService _gatewayService;
    private readonly IUserScopeService _scopeService;

    public StatusController(IGatewayService gatewayService, IUserScopeService scopeService)
    {
        _gatewayService = gatewayService;
        _scopeService = scopeService;
    }

    /// <summary>
    /// Get Cynthia's current status. Public endpoint — shows basic online/offline.
    /// Authenticated users get more detail.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _gatewayService.GetStatusAsync();

        // Basic status for unauthenticated users
        var result = new
        {
            status.Online,
            status.Model,
            status.Host
        };

        return Ok(result);
    }

    /// <summary>
    /// Get full system status (admin only)
    /// </summary>
    [HttpGet("full")]
    [Authorize]
    public async Task<IActionResult> GetFullStatus()
    {
        var email = User.FindFirst("email")?.Value ?? "";
        if (!_scopeService.IsAdmin(email))
            return Forbid();

        var status = await _gatewayService.GetStatusAsync();
        var sessions = await _gatewayService.GetSessionsAsync();

        return Ok(new
        {
            gateway = status,
            sessions,
            activeSessions = sessions.Count
        });
    }
}
