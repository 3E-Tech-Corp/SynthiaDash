using System.Net;
using System.Net.Mail;

namespace SynthiaDash.Api.Services;

public interface IEmailService
{
    Task SendDemoRequestNotification(string name, string email, string reason, string? ipAddress, string? location);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendDemoRequestNotification(string name, string email, string reason, string? ipAddress, string? location)
    {
        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning("SMTP not configured — skipping email notification for demo request from {Email}", email);
            return;
        }

        var port = _configuration.GetValue<int>("Smtp:Port", 587);
        var username = _configuration["Smtp:Username"] ?? "";
        var password = _configuration["Smtp:Password"] ?? "";
        var from = _configuration["Smtp:From"] ?? "";
        var to = _configuration["Smtp:To"] ?? "feng@xiao.legal";
        var enableSsl = _configuration.GetValue<bool>("Smtp:EnableSsl", true);

        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("SMTP From/To not configured — skipping email notification");
            return;
        }

        try
        {
            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            var body = $@"
<html>
<body style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto;"">
    <div style=""background: #7c3aed; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;"">
        <h2 style=""margin: 0;"">🎫 Demo Account Request</h2>
    </div>
    <div style=""padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;"">
        <table style=""width: 100%; border-collapse: collapse;"">
            <tr><td style=""padding: 8px 0; font-weight: 600; width: 100px;"">Name:</td><td style=""padding: 8px 0;"">{WebUtility.HtmlEncode(name)}</td></tr>
            <tr><td style=""padding: 8px 0; font-weight: 600;"">Email:</td><td style=""padding: 8px 0;""><a href=""mailto:{WebUtility.HtmlEncode(email)}"">{WebUtility.HtmlEncode(email)}</a></td></tr>
            <tr><td style=""padding: 8px 0; font-weight: 600;"">IP:</td><td style=""padding: 8px 0;"">{WebUtility.HtmlEncode(ipAddress ?? "Unknown")}</td></tr>
            <tr><td style=""padding: 8px 0; font-weight: 600;"">Location:</td><td style=""padding: 8px 0;"">{WebUtility.HtmlEncode(location ?? "Unknown")}</td></tr>
        </table>
        <div style=""margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 6px;"">
            <strong>Reason:</strong>
            <p style=""margin: 8px 0 0; white-space: pre-wrap;"">{WebUtility.HtmlEncode(reason)}</p>
        </div>
        <p style=""margin-top: 20px; color: #6b7280; font-size: 14px;"">
            Approve or reject on the <a href=""https://synthia.bot/admin/demo-requests"">dashboard</a>.
        </p>
    </div>
</body>
</html>";

            var message = new MailMessage(from, to)
            {
                Subject = $"New Demo Request: {name}",
                Body = body,
                IsBodyHtml = true
            };

            await client.SendMailAsync(message);
            _logger.LogInformation("Demo request email sent for {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send demo request email for {Email}", email);
            // Don't rethrow — Telegram is the reliable fallback
        }
    }
}
