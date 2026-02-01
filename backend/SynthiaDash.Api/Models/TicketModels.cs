namespace SynthiaDash.Api.Models;

public class Ticket
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = "bug"; // bug, feature
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public string? RepoFullName { get; set; }
    public string Status { get; set; } = "submitted"; // submitted, in_progress, completed, closed
    public string? AgentTaskId { get; set; }
    public string? Result { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    // Joined fields
    public string? UserEmail { get; set; }
    public string? UserDisplayName { get; set; }
}

public class CreateTicketRequest
{
    public string Type { get; set; } = "bug"; // bug, feature
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? RepoFullName { get; set; }
    // Image is uploaded separately via multipart form
}

public class UpdateTicketRequest
{
    public string? Status { get; set; }
    public string? Result { get; set; }
}

public class TicketComment
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public int? UserId { get; set; }
    public string UserDisplayName { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public bool IsSystemMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateCommentRequest
{
    public string Comment { get; set; } = string.Empty;
}
