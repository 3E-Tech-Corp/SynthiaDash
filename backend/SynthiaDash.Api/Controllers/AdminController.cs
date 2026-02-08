using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminController> _logger;
    private readonly string _configPath;

    public AdminController(IConfiguration configuration, ILogger<AdminController> logger)
    {
        _configuration = configuration;
        _logger = logger;
        // Production config file path
        _configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.Production.json");
    }

    /// <summary>
    /// Get admin settings (admin only)
    /// </summary>
    [HttpGet("settings")]
    public IActionResult GetSettings()
    {
        if (!IsAdmin()) return Forbid();

        return Ok(new
        {
            fullChatAgentId = _configuration["FullChat:AgentId"] ?? "vip",
            availableAgents = new[]
            {
                new { id = "vip", name = "VIP (Compartmentalized)", description = "Isolated workspace, no personal files" },
                new { id = "main", name = "Main (Full Access)", description = "Full workspace access including memory" }
            }
        });
    }

    /// <summary>
    /// Update a setting (admin only)
    /// </summary>
    [HttpPost("settings")]
    public async Task<IActionResult> UpdateSetting([FromBody] UpdateSettingRequest request)
    {
        if (!IsAdmin()) return Forbid();

        if (string.IsNullOrEmpty(request.Key) || request.Value == null)
            return BadRequest(new { error = "Key and value are required" });

        // Whitelist of allowed settings
        var allowedKeys = new[] { "FullChat:AgentId" };
        if (!allowedKeys.Contains(request.Key))
            return BadRequest(new { error = "Setting not allowed" });

        // Validate FullChat:AgentId values
        if (request.Key == "FullChat:AgentId")
        {
            var allowedAgents = new[] { "vip", "main" };
            if (!allowedAgents.Contains(request.Value))
                return BadRequest(new { error = "Invalid agent ID. Allowed: vip, main" });
        }

        try
        {
            await UpdateConfigFile(request.Key, request.Value);
            _logger.LogInformation("Admin {User} updated setting {Key} to {Value}",
                User.FindFirst("email")?.Value, request.Key, request.Value);

            return Ok(new { message = "Setting updated. Changes take effect immediately for new requests." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update setting {Key}", request.Key);
            return StatusCode(500, new { error = "Failed to update setting" });
        }
    }

    private async Task UpdateConfigFile(string key, string value)
    {
        // Read existing config or create new
        JsonDocument? existingDoc = null;
        Dictionary<string, object> config;

        if (System.IO.File.Exists(_configPath))
        {
            var json = await System.IO.File.ReadAllTextAsync(_configPath);
            existingDoc = JsonDocument.Parse(json);
            config = JsonSerializer.Deserialize<Dictionary<string, object>>(json) 
                ?? new Dictionary<string, object>();
        }
        else
        {
            config = new Dictionary<string, object>();
        }

        // Parse nested key (e.g., "FullChat:AgentId")
        var parts = key.Split(':');
        var current = config;

        for (int i = 0; i < parts.Length - 1; i++)
        {
            if (!current.ContainsKey(parts[i]))
            {
                current[parts[i]] = new Dictionary<string, object>();
            }
            
            if (current[parts[i]] is JsonElement je)
            {
                current[parts[i]] = JsonSerializer.Deserialize<Dictionary<string, object>>(je.GetRawText()) 
                    ?? new Dictionary<string, object>();
            }
            
            current = (Dictionary<string, object>)current[parts[i]];
        }

        current[parts[^1]] = value;

        // Write back
        var options = new JsonSerializerOptions { WriteIndented = true };
        await System.IO.File.WriteAllTextAsync(_configPath, JsonSerializer.Serialize(config, options));

        existingDoc?.Dispose();
    }

    private bool IsAdmin()
    {
        var role = User.FindFirst("role")?.Value;
        return role == "admin";
    }
}

public class UpdateSettingRequest
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
