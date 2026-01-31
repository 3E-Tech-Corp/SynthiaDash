namespace SynthiaDash.Api.Models;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty; // e.g., "demo123"
    public string Domain { get; set; } = string.Empty; // e.g., "demo123.pickleball.community"
    public string RepoFullName { get; set; } = string.Empty; // e.g., "3E-Tech-Corp/demo123"
    public string DatabaseName { get; set; } = string.Empty; // e.g., "Demo123_DB"
    public string IisSiteName { get; set; } = string.Empty; // e.g., "demo123.pickleball.community"
    public string Status { get; set; } = "pending"; // pending, provisioning, ready, failed
    public string? StatusDetail { get; set; } // step-by-step progress
    public string? Error { get; set; }
    public int CreatedByUserId { get; set; }
    public string? CreatedByEmail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadyAt { get; set; }
}

public class CreateProjectRequest
{
    public string Name { get; set; } = string.Empty; // Display name
    public string Slug { get; set; } = string.Empty; // URL-safe identifier
    public string Domain { get; set; } = string.Empty; // Full domain
    public string? BaseDomain { get; set; } // e.g., "pickleball.community" for subdomain creation
}
