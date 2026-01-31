using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly ITicketService _ticketService;
    private readonly ITaskService _taskService;
    private readonly INotificationService _notificationService;
    private readonly IUserScopeService _userScopeService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TicketsController> _logger;

    public TicketsController(
        ITicketService ticketService,
        ITaskService taskService,
        INotificationService notificationService,
        IUserScopeService userScopeService,
        IConfiguration configuration,
        ILogger<TicketsController> logger)
    {
        _ticketService = ticketService;
        _taskService = taskService;
        _notificationService = notificationService;
        _userScopeService = userScopeService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get all tickets (admin sees all, others see their own)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetTickets([FromQuery] int limit = 50)
    {
        var email = User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var isAdmin = _userScopeService.IsAdmin(email);

        var tickets = isAdmin
            ? await _ticketService.GetTicketsAsync(limit: limit)
            : await _ticketService.GetTicketsAsync(userId: GetUserId(), limit: limit);

        return Ok(tickets);
    }

    /// <summary>
    /// Get a single ticket
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetTicket(int id)
    {
        var ticket = await _ticketService.GetTicketAsync(id);
        if (ticket == null) return NotFound();

        var email = User.FindFirst("email")?.Value;
        var isAdmin = _userScopeService.IsAdmin(email ?? "");

        // Non-admins can only see their own tickets
        if (!isAdmin && ticket.UserId != GetUserId())
            return Forbid();

        return Ok(ticket);
    }

    /// <summary>
    /// Create a ticket (text + optional image). Checks user's TicketAccess level.
    /// </summary>
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreateTicket(
        [FromForm] string type,
        [FromForm] string title,
        [FromForm] string description,
        [FromForm] string? repoFullName,
        IFormFile? image)
    {
        var userId = GetUserId();
        var email = User.FindFirst("email")?.Value ?? "";
        var isAdmin = _userScopeService.IsAdmin(email);

        // Check ticket access (admins always have execute)
        var access = isAdmin ? "execute" : await _ticketService.GetUserTicketAccessAsync(userId);

        if (access == "none")
            return Forbid("You don't have permission to submit tickets.");

        // Validate type
        if (type != "bug" && type != "feature")
            return BadRequest(new { error = "Type must be 'bug' or 'feature'" });

        if (string.IsNullOrWhiteSpace(title))
            return BadRequest(new { error = "Title is required" });

        if (string.IsNullOrWhiteSpace(description))
            return BadRequest(new { error = "Description is required" });

        // Handle image upload
        string? imagePath = null;
        if (image != null && image.Length > 0)
        {
            // Validate image
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(image.ContentType.ToLower()))
                return BadRequest(new { error = "Image must be JPEG, PNG, GIF, or WebP" });

            if (image.Length > 10 * 1024 * 1024) // 10MB limit
                return BadRequest(new { error = "Image must be under 10MB" });

            var uploadsDir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
            Directory.CreateDirectory(uploadsDir);

            var ext = Path.GetExtension(image.FileName).ToLower();
            if (string.IsNullOrEmpty(ext)) ext = ".png";
            var fileName = $"{Guid.NewGuid():N}{ext}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await image.CopyToAsync(stream);
            }

            imagePath = $"tickets/{fileName}";
        }

        var request = new CreateTicketRequest
        {
            Type = type,
            Title = title,
            Description = description,
            RepoFullName = repoFullName
        };

        var ticket = await _ticketService.CreateTicketAsync(userId, request, imagePath);

        _logger.LogInformation("Ticket #{Id} created by {Email} (access: {Access})", ticket.Id, email, access);

        // Handle based on access level
        if (access == "execute")
        {
            // Auto-execute: create agent task and trigger
            _ = Task.Run(async () =>
            {
                try
                {
                    await _notificationService.NotifyTicketExecuting(ticket);
                    await TriggerAgentForTicket(ticket);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to auto-execute ticket #{Id}", ticket.Id);
                }
            });
        }
        else // access == "submit"
        {
            // Just notify Feng
            _ = Task.Run(async () =>
            {
                try
                {
                    await _notificationService.NotifyTicketSubmitted(ticket);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to notify about ticket #{Id}", ticket.Id);
                }
            });
        }

        return Ok(ticket);
    }

    /// <summary>
    /// Update ticket status/result (admin only)
    /// </summary>
    [HttpPatch("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateTicket(int id, [FromBody] UpdateTicketRequest request)
    {
        var ticket = await _ticketService.UpdateTicketAsync(id, request);
        if (ticket == null) return NotFound();
        return Ok(ticket);
    }

    /// <summary>
    /// Delete a ticket (admin or owner)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTicket(int id)
    {
        var ticket = await _ticketService.GetTicketAsync(id);
        if (ticket == null) return NotFound();

        var email = User.FindFirst("email")?.Value;
        var isAdmin = _userScopeService.IsAdmin(email ?? "");

        if (!isAdmin && ticket.UserId != GetUserId())
            return Forbid();

        await _ticketService.DeleteTicketAsync(id);
        return Ok(new { message = "Ticket deleted" });
    }

    /// <summary>
    /// Serve uploaded ticket images
    /// </summary>
    [HttpGet("image/{fileName}")]
    [AllowAnonymous] // Images need a direct URL; security through obscurity (GUID names)
    public IActionResult GetImage(string fileName)
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets", fileName);

        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var ext = Path.GetExtension(fileName).ToLower();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return PhysicalFile(filePath, contentType);
    }

    /// <summary>
    /// Admin: manually trigger agent execution for a ticket
    /// </summary>
    [HttpPost("{id}/execute")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ExecuteTicket(int id)
    {
        var ticket = await _ticketService.GetTicketAsync(id);
        if (ticket == null) return NotFound();

        if (ticket.Status != "submitted")
            return BadRequest(new { error = "Ticket must be in 'submitted' status to execute" });

        _ = Task.Run(async () =>
        {
            try
            {
                await TriggerAgentForTicket(ticket);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute ticket #{Id}", ticket.Id);
            }
        });

        return Ok(new { message = "Execution started" });
    }

    /// <summary>
    /// Check current user's ticket access level
    /// </summary>
    [HttpGet("access")]
    public async Task<IActionResult> GetAccess()
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var isAdmin = _userScopeService.IsAdmin(email);

        if (isAdmin)
            return Ok(new { access = "execute" });

        var access = await _ticketService.GetUserTicketAccessAsync(GetUserId());
        return Ok(new { access });
    }

    private async Task TriggerAgentForTicket(Ticket ticket)
    {
        var typeLabel = ticket.Type == "bug" ? "Bug Report" : "Feature Request";
        var prompt = $"## {typeLabel}: {ticket.Title}\n\n"
            + $"**Submitted by:** {ticket.UserDisplayName}\n"
            + (string.IsNullOrEmpty(ticket.RepoFullName) ? "" : $"**Repository:** {ticket.RepoFullName}\n")
            + $"\n### Description:\n{ticket.Description}\n";

        if (!string.IsNullOrEmpty(ticket.ImagePath))
        {
            var appBaseUrl = _configuration["App:BaseUrl"] ?? "https://ai.3eweb.com";
            prompt += $"\n### Screenshot:\n{appBaseUrl}/api/tickets/image/{Path.GetFileName(ticket.ImagePath)}\n";
        }

        var callbackUrl = _configuration["App:BaseUrl"] ?? "https://ai.3eweb.com";
        prompt += $"\n### Instructions:\n"
            + "1. Analyze the issue described above\n"
            + (string.IsNullOrEmpty(ticket.RepoFullName)
                ? "2. Determine which repo this relates to and fix it\n"
                : $"2. Work on repository: {ticket.RepoFullName}\n")
            + "3. Implement the fix or feature\n"
            + "4. Commit and push your changes\n"
            + $"5. When done, POST to: {callbackUrl}/api/tickets/{ticket.Id}/complete\n"
            + "   Body: {\"status\": \"completed\", \"result\": \"Your summary\"}\n";

        // Create the agent task
        var agentTask = await _taskService.CreateTaskAsync(
            ticket.RepoFullName ?? "unknown",
            prompt,
            null);

        // Update ticket with task reference
        await _ticketService.UpdateTicketAsync(ticket.Id, new UpdateTicketRequest
        {
            Status = "in_progress"
        });

        // Update the agent task ID on the ticket via raw SQL (TicketService doesn't expose this)
        // We'll just track it through the task service
        _logger.LogInformation("Agent task {TaskId} created for ticket #{TicketId}", agentTask.Id, ticket.Id);

        // Trigger the agent
        await _taskService.TriggerAgentAsync(agentTask);
    }

    /// <summary>
    /// Callback from agent when ticket work is complete
    /// </summary>
    [HttpPost("{id}/complete")]
    [AllowAnonymous] // Called by the agent via webhook
    public async Task<IActionResult> CompleteTicket(int id, [FromBody] CompleteTicketCallback request)
    {
        var ticket = await _ticketService.UpdateTicketAsync(id, new UpdateTicketRequest
        {
            Status = request.Status ?? "completed",
            Result = request.Result
        });

        if (ticket == null) return NotFound();

        _logger.LogInformation("Ticket #{Id} completed: {Status}", id, request.Status);
        return Ok(ticket);
    }

    private int GetUserId()
    {
        var userIdStr = User.FindFirst("userId")?.Value;
        return int.TryParse(userIdStr, out var id) ? id : 0;
    }
}

public class CompleteTicketCallback
{
    public string? Status { get; set; }
    public string? Result { get; set; }
}
