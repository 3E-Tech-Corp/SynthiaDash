using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("api/notification-settings")]
[Authorize]
public class NotificationSettingsController : ControllerBase
{
    private readonly INotificationSettingsService _settingsService;
    private readonly IFXNotificationClient _fxClient;
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationSettingsController> _logger;

    public NotificationSettingsController(
        INotificationSettingsService settingsService,
        IFXNotificationClient fxClient,
        INotificationService notificationService,
        ILogger<NotificationSettingsController> logger)
    {
        _settingsService = settingsService;
        _fxClient = fxClient;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// List all notification settings (event → task mappings)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!IsAdmin()) return Forbid();

        var settings = await _settingsService.GetAllAsync();
        return Ok(settings);
    }

    /// <summary>
    /// Update a notification setting (TaskCode, IsEnabled)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateNotificationSettingRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var updated = await _settingsService.UpdateAsync(id, request.TaskCode, request.IsEnabled);
        if (updated == null) return NotFound();

        _logger.LogInformation("Admin updated notification setting #{Id}: TaskCode={TaskCode}, Enabled={Enabled}",
            id, request.TaskCode, request.IsEnabled);

        return Ok(updated);
    }

    /// <summary>
    /// Get available tasks from FXNotification service
    /// </summary>
    [HttpGet("available-tasks")]
    public async Task<IActionResult> GetAvailableTasks()
    {
        if (!IsAdmin()) return Forbid();

        var tasks = await _fxClient.GetTasksAsync();
        return Ok(tasks);
    }

    /// <summary>
    /// Send a test notification for an event code
    /// </summary>
    [HttpPost("test/{eventCode}")]
    public async Task<IActionResult> SendTest(string eventCode)
    {
        if (!IsAdmin()) return Forbid();

        var setting = await _settingsService.GetByEventCodeAsync(eventCode);
        if (setting == null) return NotFound(new { error = $"Event code '{eventCode}' not found" });

        if (string.IsNullOrEmpty(setting.TaskCode))
            return BadRequest(new { error = "No TaskCode configured for this event" });

        var testData = new
        {
            eventCode,
            eventName = setting.EventName,
            message = $"Test notification for {setting.EventName} ({eventCode})",
            timestamp = DateTime.UtcNow
        };

        var email = User.FindFirst("email")?.Value ?? "test@synthia.bot";

        var result = await _fxClient.QueueAsync(
            taskCode: setting.TaskCode,
            to: email,
            bodyJson: testData,
            bodyHtml: $"<p>🔔 Test notification for <strong>{setting.EventName}</strong> ({eventCode})</p><p>Sent at {DateTime.UtcNow:u}</p>");

        if (result.Success)
        {
            _logger.LogInformation("Test notification sent for {EventCode} by {Email}", eventCode, email);
            return Ok(new { message = "Test notification sent", id = result.Id });
        }

        return StatusCode(502, new { error = "Failed to queue test notification", detail = result.Error });
    }

    /// <summary>
    /// Health check for FXNotification service connectivity
    /// </summary>
    [HttpGet("health")]
    public async Task<IActionResult> HealthCheck()
    {
        if (!IsAdmin()) return Forbid();

        var health = await _fxClient.HealthCheckAsync();
        return Ok(health);
    }

    private bool IsAdmin()
    {
        return User.IsInRole("admin");
    }
}

public class UpdateNotificationSettingRequest
{
    public string? TaskCode { get; set; }
    public bool IsEnabled { get; set; }
}
