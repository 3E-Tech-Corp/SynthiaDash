using System.Text;
using System.Text.Json;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

/// <summary>
/// Sends notifications to Feng via the Clawdbot gateway (Telegram)
/// and routes event-based notifications through FXNotification.
/// </summary>
public interface INotificationService
{
    Task NotifyTicketSubmitted(Ticket ticket);
    Task NotifyTicketExecuting(Ticket ticket);
    Task NotifyTicketFlagged(Ticket ticket);
    Task NotifyProjectProvisioned(Project project);
    Task NotifyProjectBriefSet(Project project, Ticket ticket);
    Task NotifyDemoRequest(string name, string email, string reason, string? ipAddress, string? location);

    /// <summary>
    /// Send a notification via FXNotification using the event code mapping.
    /// Looks up TaskCode from NotificationSettings; if enabled, queues via FXNotificationClient.
    /// Fire-and-forget safe — logs failures but never throws.
    /// </summary>
    Task FXSendAsync(string eventCode, string to, object? data = null);

    /// <summary>
    /// Fire-and-forget wrapper for FXSendAsync. Callers don't block on notification sending.
    /// </summary>
    void FXSendFireAndForget(string eventCode, string to, object? data = null);
}

public class NotificationService : INotificationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationService> _logger;
    private readonly IFXNotificationClient _fxClient;
    private readonly INotificationSettingsService _settingsService;

    public NotificationService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<NotificationService> logger,
        IFXNotificationClient fxClient,
        INotificationSettingsService settingsService)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _fxClient = fxClient;
        _settingsService = settingsService;
    }

    public async Task NotifyTicketSubmitted(Ticket ticket)
    {
        var emoji = ticket.Type == "bug" ? "🐛" : "💡";
        var typeLabel = ticket.Type == "bug" ? "Bug Report" : "Feature Request";

        var message = $"{emoji} **New {typeLabel} Submitted**\n\n"
            + $"**From:** {ticket.UserDisplayName} ({ticket.UserEmail})\n"
            + $"**Title:** {ticket.Title}\n"
            + (string.IsNullOrEmpty(ticket.RepoFullName) ? "" : $"**Repo:** {ticket.RepoFullName}\n")
            + $"\n{ticket.Description}";

        if (!string.IsNullOrEmpty(ticket.ImagePath))
            message += "\n\n📎 Image attached (view on dashboard)";

        await SendToGateway(message);
    }

    public async Task NotifyTicketFlagged(Ticket ticket)
    {
        var message = $"⚠️ **Ticket Flagged for Review**\n\n"
            + $"**From:** {ticket.UserDisplayName} ({ticket.UserEmail})\n"
            + $"**Title:** {ticket.Title}\n"
            + $"**Submitted as:** Bug Report\n"
            + $"**Reason:** Looks like a feature request disguised as a bug.\n"
            + (string.IsNullOrEmpty(ticket.RepoFullName) ? "" : $"**Repo:** {ticket.RepoFullName}\n")
            + $"\n{ticket.Description}\n\n"
            + "Review it on the dashboard and execute manually if it's legit.";

        await SendToGateway(message);
    }

    public async Task NotifyProjectProvisioned(Project project)
    {
        var message = $"🚀 **Project Provisioned**\n\n"
            + $"**Name:** {project.Name}\n"
            + $"**Domain:** {project.Domain}\n"
            + $"**Repo:** github.com/{project.RepoFullName}\n"
            + $"**Database:** {project.DatabaseName}\n\n"
            + "Ready for development! Assign users on the dashboard.";

        await SendToGateway(message);
    }

    public async Task NotifyProjectBriefSet(Project project, Ticket ticket)
    {
        var message = $"📋 **Project Brief Set**\n\n"
            + $"**Project:** {project.Name} ({project.Domain})\n"
            + $"**Set by:** {ticket.UserDisplayName} ({ticket.UserEmail})\n"
            + $"**From ticket:** {ticket.Title}\n\n"
            + $"**Vision:**\n{project.ProjectBrief}\n\n"
            + "Future feature requests for this project will use this as context.";

        await SendToGateway(message);
    }

    public async Task NotifyTicketExecuting(Ticket ticket)
    {
        var emoji = ticket.Type == "bug" ? "🐛" : "💡";
        var typeLabel = ticket.Type == "bug" ? "Bug Report" : "Feature Request";

        var message = $"🤖 **Auto-executing {typeLabel}**\n\n"
            + $"**From:** {ticket.UserDisplayName} ({ticket.UserEmail})\n"
            + $"**Title:** {ticket.Title}\n"
            + (string.IsNullOrEmpty(ticket.RepoFullName) ? "" : $"**Repo:** {ticket.RepoFullName}\n")
            + $"\nI'm starting work on this now.";

        await SendToGateway(message);
    }

    public async Task NotifyDemoRequest(string name, string email, string reason, string? ipAddress, string? location)
    {
        var message = "🎫 **Demo Account Request**\n\n"
            + $"**Name:** {name}\n"
            + $"**Email:** {email}\n"
            + $"**IP:** {ipAddress ?? "Unknown"}\n"
            + $"**Location:** {location ?? "Unknown"}\n\n"
            + $"**Reason:**\n{reason}\n\n"
            + "Approve or reject on the dashboard.";

        await SendToGateway(message);
    }

    public async Task FXSendAsync(string eventCode, string to, object? data = null)
    {
        try
        {
            var setting = await _settingsService.GetByEventCodeAsync(eventCode);
            if (setting == null)
            {
                _logger.LogWarning("No NotificationSettings found for event code {EventCode}", eventCode);
                return;
            }

            if (!setting.IsEnabled)
            {
                _logger.LogDebug("Notification for event {EventCode} is disabled", eventCode);
                return;
            }

            if (string.IsNullOrEmpty(setting.TaskCode))
            {
                _logger.LogWarning("No TaskCode configured for event {EventCode}", eventCode);
                return;
            }

            string? bodyJson = data != null ? JsonSerializer.Serialize(data) : null;

            var result = await _fxClient.QueueAsync(
                taskCode: setting.TaskCode,
                to: to,
                bodyJson: data,
                bodyHtml: null,
                detailJson: null,
                objectId: null);

            if (result.Success)
                _logger.LogInformation("FXNotification queued for event {EventCode} to {To} (id: {Id})", eventCode, to, result.Id);
            else
                _logger.LogError("FXNotification queue failed for event {EventCode}: {Error}", eventCode, result.Error);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send FXNotification for event {EventCode} to {To}", eventCode, to);
            // Never throw — fire-and-forget safe
        }
    }

    public void FXSendFireAndForget(string eventCode, string to, object? data = null)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await FXSendAsync(eventCode, to, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fire-and-forget FXNotification failed for {EventCode}", eventCode);
            }
        });
    }

    private async Task SendToGateway(string message)
    {
        try
        {
            var gatewayBaseUrl = _configuration["Gateway:BaseUrl"] ?? "http://localhost:18789";
            var token = _configuration["Gateway:HookToken"] ?? _configuration["Gateway:Token"];

            var client = _httpClientFactory.CreateClient();
            if (!string.IsNullOrEmpty(token))
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            var payload = new
            {
                message,
                name = "SynthiaDash",
                deliver = true,
                channel = "telegram"
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{gatewayBaseUrl}/hooks/agent", content);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("Gateway notification failed: {Status} {Body}", response.StatusCode, body);
            }
            else
            {
                _logger.LogInformation("Notification sent to gateway successfully");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send notification to gateway");
        }
    }
}
