namespace SynthiaDash.Api.Models;

public class AgentTask
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string RepoFullName { get; set; } = string.Empty;
    public string Status { get; set; } = "pending"; // pending, running, completed, failed
    public string? ErrorContent { get; set; }
    public string? Prompt { get; set; }
    public string? Result { get; set; }
    public string? PrUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string SessionKey { get; set; } = string.Empty;
}

public class CreateTaskRequest
{
    public string RepoFullName { get; set; } = string.Empty;
    public string? CustomPrompt { get; set; }
}

public class CompleteTaskRequest
{
    public string Status { get; set; } = "completed";
    public string Result { get; set; } = string.Empty;
    public string? PrUrl { get; set; }
}
