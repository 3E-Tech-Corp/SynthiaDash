namespace SynthiaDash.Api.Models;

public class UserScope
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "viewer"; // admin, member, viewer
    public List<string> Repos { get; set; } = new();
}

public class GatewayStatus
{
    public bool Online { get; set; }
    public string? Model { get; set; }
    public string? Version { get; set; }
    public long? UptimeMs { get; set; }
    public string? Host { get; set; }
}

public class RepoStatus
{
    public string Name { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool Private { get; set; }
    public string? DefaultBranch { get; set; }
    public DateTime? LastPush { get; set; }
    public DeployInfo? LastDeploy { get; set; }
}

public class DeployInfo
{
    public long RunId { get; set; }
    public string Status { get; set; } = string.Empty; // success, failure, in_progress
    public string? Commit { get; set; }
    public string? CommitMessage { get; set; }
    public DateTime? StartedAt { get; set; }
    public int? DurationSeconds { get; set; }
}

public class SessionInfo
{
    public string Key { get; set; } = string.Empty;
    public string? Kind { get; set; }
    public string? Channel { get; set; }
    public DateTime? LastActivity { get; set; }
    public int MessageCount { get; set; }
}
