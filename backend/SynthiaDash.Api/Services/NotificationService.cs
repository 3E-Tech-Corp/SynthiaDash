using System.Text;
using System.Text.Json;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

/// <summary>
/// Sends notifications to Feng via the Clawdbot gateway (Telegram).
/// </summary>
public interface INotificationService
{
    Task NotifyTicketSubmitted(Ticket ticket);
    Task NotifyTicketExecuting(Ticket ticket);
}

public class NotificationService : INotificationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<NotificationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
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

    private async Task SendToGateway(string message)
    {
        try
        {
            var gatewayBaseUrl = _configuration["Gateway:BaseUrl"] ?? "http://localhost:18789";
            var token = _configuration["Gateway:Token"];

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
