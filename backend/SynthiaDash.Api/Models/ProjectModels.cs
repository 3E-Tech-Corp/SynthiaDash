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
    public string? ProjectBrief { get; set; }
    public DateTime? ProjectBriefSetAt { get; set; }
    public string? Description { get; set; }
}

public class CreateProjectRequest
{
    public string Name { get; set; } = string.Empty; // Display name
    public string Slug { get; set; } = string.Empty; // URL-safe identifier
    public string Domain { get; set; } = string.Empty; // Full domain
    public string? BaseDomain { get; set; } // e.g., "pickleball.community" for subdomain creation
    public string? Description { get; set; }
    public string? RepoFullName { get; set; } // If set, link to existing repo instead of provisioning
    public bool LinkExisting { get; set; } = false; // true = link existing repo, skip provisioning
}

public class UpdateProjectRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? RepoFullName { get; set; } // Link/update to a different repo
    public string? Domain { get; set; }
}

public class ProjectMember
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int UserId { get; set; }
    public string Role { get; set; } = "developer"; // owner, developer, viewer
    public DateTime AddedAt { get; set; }
    public int? AddedBy { get; set; }

    // Per-project permission overrides (null = inherit from user's global setting)
    public string? BugAccess { get; set; }
    public string? FeatureAccess { get; set; }
    public string? ChatAccess { get; set; }

    // Joined fields
    public string? UserEmail { get; set; }
    public string? UserDisplayName { get; set; }

    // Joined from Users table (for showing effective/inherited values)
    public string? GlobalBugAccess { get; set; }
    public string? GlobalFeatureAccess { get; set; }
    public string? GlobalChatAccess { get; set; }
}

public class AddProjectMemberRequest
{
    public int UserId { get; set; }
    public string Role { get; set; } = "developer"; // owner, developer, viewer
}

public class UpdateProjectMemberRequest
{
    public string Role { get; set; } = "developer"; // owner, developer, viewer
}

public class UpdateProjectMemberPermissionsRequest
{
    public string? BugAccess { get; set; }     // null, "none", "submit", "execute"
    public string? FeatureAccess { get; set; } // null, "none", "submit", "execute"
    public string? ChatAccess { get; set; }    // null, "none", "guide", "bug", "developer"
}
