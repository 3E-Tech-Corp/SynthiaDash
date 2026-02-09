namespace SynthiaDash.Api.Models;

public class Feedback
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Organization { get; set; }
    public bool IsApproved { get; set; }
    public bool IsPublic { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FeedbackCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Organization { get; set; }
    public bool AllowPublic { get; set; }
}

public class FeedbackPublicDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Organization { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
