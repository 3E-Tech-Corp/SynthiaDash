using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Email and password required" });

        var result = await _authService.LoginAsync(request.Email, request.Password);

        if (!result.Success)
            return Unauthorized(new { error = result.Error });

        return Ok(new { token = result.Token, user = result.User });
    }

    [HttpPost("register")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Email, display name, and password required" });

        var result = await _authService.RegisterAsync(
            request.Email,
            request.DisplayName ?? request.Email.Split('@')[0],
            request.Password,
            request.Role ?? "viewer");

        if (!result.Success)
            return BadRequest(new { error = result.Error });

        return Ok(new { token = result.Token, user = result.User });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var email = User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email))
            return Unauthorized();

        var user = await _authService.GetUserByEmailAsync(email);
        if (user == null) return NotFound();

        return Ok(user);
    }

    /// <summary>
    /// Admin: list all users
    /// </summary>
    [HttpGet("users")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _authService.GetAllUsersAsync();
        return Ok(users);
    }

    /// <summary>
    /// Bootstrap: create first admin user (only works if no users exist)
    /// </summary>
    [HttpPost("setup")]
    [AllowAnonymous]
    public async Task<IActionResult> Setup([FromBody] RegisterRequest request)
    {
        var users = await _authService.GetAllUsersAsync();
        if (users.Count > 0)
            return BadRequest(new { error = "Setup already complete. Use admin to register new users." });

        var result = await _authService.RegisterAsync(
            request.Email,
            request.DisplayName ?? request.Email.Split('@')[0],
            request.Password,
            "admin");

        if (!result.Success)
            return BadRequest(new { error = result.Error });

        return Ok(new { token = result.Token, user = result.User });
    }

    /// <summary>
    /// Change current user's password
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { error = "New password must be at least 6 characters" });

        var userIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var success = await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
        if (!success)
            return BadRequest(new { error = "Current password is incorrect" });

        return Ok(new { message = "Password changed successfully" });
    }

    /// <summary>
    /// Admin: reset any user's password
    /// </summary>
    [HttpPost("reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { error = "New password must be at least 6 characters" });

        var success = await _authService.ResetPasswordAsync(request.UserId, request.NewPassword);
        if (!success)
            return NotFound(new { error = "User not found" });

        return Ok(new { message = "Password reset successfully" });
    }

    /// <summary>
    /// Admin: update user role/repos/active status
    /// </summary>
    [HttpPatch("users/{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var success = await _authService.UpdateUserAsync(id, request.Role, request.Repos, request.IsActive,
            request.TicketAccess, request.BugAccess, request.FeatureAccess, request.ChatAccess, request.MaxProjects);
        if (!success) return NotFound();
        return Ok(new { message = "User updated" });
    }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Password { get; set; } = string.Empty;
    public string? Role { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public int UserId { get; set; }
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateUserRequest
{
    public string? Role { get; set; }
    public string? Repos { get; set; }
    public bool? IsActive { get; set; }
    public string? TicketAccess { get; set; }
    public string? BugAccess { get; set; }
    public string? FeatureAccess { get; set; }
    public string? ChatAccess { get; set; }
    public int? MaxProjects { get; set; }
}
