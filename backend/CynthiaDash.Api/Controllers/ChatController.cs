using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CynthiaDash.Api.Services;

namespace CynthiaDash.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IGatewayService _gatewayService;
    private readonly IUserScopeService _scopeService;

    public ChatController(IGatewayService gatewayService, IUserScopeService scopeService)
    {
        _gatewayService = gatewayService;
        _scopeService = scopeService;
    }

    /// <summary>
    /// Send a message to Cynthia, scoped to the user's repos
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] ChatRequest request)
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var scope = _scopeService.GetUserScope(email);

        if (scope.Role == "none")
            return Forbid();

        // Prefix message with scope context so Cynthia knows who's talking and their limits
        var scopedMessage = $"[Dashboard: {email} | Role: {scope.Role} | Repos: {string.Join(", ", scope.Repos)}]\n{request.Message}";

        var response = await _gatewayService.SendMessageAsync(
            request.SessionKey ?? $"dash-{email}",
            scopedMessage);

        return Ok(new { response });
    }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SessionKey { get; set; }
}
