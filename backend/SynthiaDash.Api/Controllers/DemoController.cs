using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class DemoController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly IEmailService _emailService;
    private readonly IRateLimitService _rateLimitService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DemoController> _logger;
    private readonly string _connectionString;

    public DemoController(
        IConfiguration configuration,
        INotificationService notificationService,
        IEmailService emailService,
        IRateLimitService rateLimitService,
        IHttpClientFactory httpClientFactory,
        ILogger<DemoController> logger)
    {
        _configuration = configuration;
        _notificationService = notificationService;
        _emailService = emailService;
        _rateLimitService = rateLimitService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
    }

    /// <summary>
    /// Submit a demo account request (public, rate-limited)
    /// </summary>
    [HttpPost("request")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestDemo([FromBody] CreateDemoRequest request)
    {
        // Validate
        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
            return BadRequest(new { error = "A valid email address is required." });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required." });

        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 10)
            return BadRequest(new { error = "Please provide a reason (at least 10 characters)." });

        // Get IP
        var ip = GetClientIp();

        // Rate limit: 3 per IP per hour
        var rateLimitKey = $"demo-request:{ip}";
        if (_rateLimitService.IsRateLimited(rateLimitKey, 3, TimeSpan.FromHours(1)))
            return StatusCode(429, new { error = "Too many requests. Please try again later." });

        _rateLimitService.RecordAttempt(rateLimitKey);

        // Geo-lookup
        string? location = null;
        try
        {
            location = await GeoLookup(ip);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geo-lookup failed for IP {Ip}", ip);
        }

        // Save to database
        try
        {
            using var db = new SqlConnection(_connectionString);
            await db.ExecuteAsync(
                @"INSERT INTO DemoRequests (Email, Name, Reason, IpAddress, Location)
                  VALUES (@Email, @Name, @Reason, @IpAddress, @Location)",
                new
                {
                    Email = request.Email.Trim(),
                    Name = request.Name.Trim(),
                    Reason = request.Reason.Trim(),
                    IpAddress = ip,
                    Location = location
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save demo request");
            return StatusCode(500, new { error = "Failed to save request. Please try again." });
        }

        // Send notifications (fire-and-forget, don't block the response)
        _ = Task.Run(async () =>
        {
            try
            {
                await _notificationService.NotifyDemoRequest(
                    request.Name.Trim(), request.Email.Trim(), request.Reason.Trim(), ip, location);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send Telegram notification for demo request");
            }

            try
            {
                await _emailService.SendDemoRequestNotification(
                    request.Name.Trim(), request.Email.Trim(), request.Reason.Trim(), ip, location);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email notification for demo request");
            }
        });

        return Ok(new { message = "Request submitted! We'll review it and get back to you." });
    }

    /// <summary>
    /// List all demo requests (admin only)
    /// </summary>
    [HttpGet("requests")]
    [Authorize]
    public async Task<IActionResult> GetRequests()
    {
        var email = User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            return Forbid();

        using var db = new SqlConnection(_connectionString);
        var requests = await db.QueryAsync<DemoRequest>(
            "SELECT * FROM DemoRequests ORDER BY CreatedAt DESC");

        return Ok(requests);
    }

    /// <summary>
    /// Update demo request status (admin only)
    /// </summary>
    [HttpPatch("requests/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateRequestStatus(int id, [FromBody] UpdateDemoRequestStatus update)
    {
        var email = User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            return Forbid();

        if (update.Status != "approved" && update.Status != "rejected")
            return BadRequest(new { error = "Status must be 'approved' or 'rejected'." });

        var userId = GetUserId();

        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync(
            @"UPDATE DemoRequests 
              SET Status = @Status, ReviewedAt = GETUTCDATE(), ReviewedBy = @ReviewedBy 
              WHERE Id = @Id",
            new { Id = id, Status = update.Status, ReviewedBy = userId });

        if (rows == 0) return NotFound(new { error = "Demo request not found." });

        return Ok(new { message = $"Request {update.Status}." });
    }

    private string GetClientIp()
    {
        // Cloudflare sends CF-Connecting-IP, fall back to X-Forwarded-For, then RemoteIpAddress
        var cfIp = Request.Headers["CF-Connecting-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(cfIp)) return cfIp;

        var forwardedFor = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Take the first IP in the chain (original client)
            return forwardedFor.Split(',')[0].Trim();
        }

        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private async Task<string?> GeoLookup(string ip)
    {
        if (ip == "unknown" || ip == "::1" || ip.StartsWith("127.") || ip.StartsWith("192.168.") || ip.StartsWith("10."))
            return "Local/Private Network";

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(5);

        var response = await client.GetAsync($"http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp");
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("status", out var status) && status.GetString() == "success")
        {
            var city = root.TryGetProperty("city", out var c) ? c.GetString() : null;
            var region = root.TryGetProperty("regionName", out var r) ? r.GetString() : null;
            var country = root.TryGetProperty("country", out var co) ? co.GetString() : null;
            var isp = root.TryGetProperty("isp", out var i) ? i.GetString() : null;

            var parts = new[] { city, region, country }.Where(p => !string.IsNullOrEmpty(p));
            var locationStr = string.Join(", ", parts);
            if (!string.IsNullOrEmpty(isp))
                locationStr += $" ({isp})";

            return locationStr;
        }

        return null;
    }

    private static bool IsValidEmail(string email)
    {
        return Regex.IsMatch(email.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
    }

    private bool IsAdmin(string email)
    {
        var adminEmails = _configuration.GetSection("Admin:Emails").Get<string[]>() ?? Array.Empty<string>();
        return adminEmails.Contains(email, StringComparer.OrdinalIgnoreCase);
    }

    private int GetUserId()
    {
        var idClaim = User.FindFirst("id")?.Value
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idClaim, out var id) ? id : 0;
    }
}
