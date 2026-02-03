using Dapper;
using Microsoft.Data.SqlClient;

namespace SynthiaDash.Api.Services;

public interface IPermissionService
{
    Task<string> GetEffectiveBugAccess(int userId, int? projectId);
    Task<string> GetEffectiveFeatureAccess(int userId, int? projectId);
    Task<string> GetEffectiveChatAccess(int userId, int? projectId);
}

public class PermissionService : IPermissionService
{
    private readonly string _connectionString;
    private readonly IUserScopeService _userScopeService;

    public PermissionService(IConfiguration configuration, IUserScopeService userScopeService)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection");
        _userScopeService = userScopeService;
    }

    public async Task<string> GetEffectiveBugAccess(int userId, int? projectId)
    {
        // Admin always gets full access
        if (await IsAdmin(userId))
            return "execute";

        // Check project-level override
        if (projectId.HasValue)
        {
            var projectOverride = await GetProjectMemberAccess(userId, projectId.Value, "BugAccess");
            if (projectOverride != null)
                return projectOverride;
        }

        // Fall back to global
        return await GetGlobalAccess(userId, "BugAccess") ?? "none";
    }

    public async Task<string> GetEffectiveFeatureAccess(int userId, int? projectId)
    {
        if (await IsAdmin(userId))
            return "execute";

        if (projectId.HasValue)
        {
            var projectOverride = await GetProjectMemberAccess(userId, projectId.Value, "FeatureAccess");
            if (projectOverride != null)
                return projectOverride;
        }

        return await GetGlobalAccess(userId, "FeatureAccess") ?? "none";
    }

    public async Task<string> GetEffectiveChatAccess(int userId, int? projectId)
    {
        if (await IsAdmin(userId))
            return "developer";

        if (projectId.HasValue)
        {
            var projectOverride = await GetProjectMemberAccess(userId, projectId.Value, "ChatAccess");
            if (projectOverride != null)
                return projectOverride;
        }

        return await GetGlobalAccess(userId, "ChatAccess") ?? "none";
    }

    private async Task<bool> IsAdmin(int userId)
    {
        using var db = new SqlConnection(_connectionString);
        var email = await db.QueryFirstOrDefaultAsync<string>(
            "SELECT Email FROM Users WHERE Id = @Id AND IsActive = 1", new { Id = userId });
        return email != null && _userScopeService.IsAdmin(email);
    }

    private async Task<string?> GetProjectMemberAccess(int userId, int projectId, string column)
    {
        using var db = new SqlConnection(_connectionString);
        // Safe: column is always one of our known column names, not user input
        var sql = $"SELECT {column} FROM ProjectMembers WHERE UserId = @UserId AND ProjectId = @ProjectId";
        return await db.QueryFirstOrDefaultAsync<string?>(sql, new { UserId = userId, ProjectId = projectId });
    }

    private async Task<string?> GetGlobalAccess(int userId, string column)
    {
        using var db = new SqlConnection(_connectionString);
        var sql = $"SELECT {column} FROM Users WHERE Id = @Id AND IsActive = 1";
        return await db.QueryFirstOrDefaultAsync<string?>(sql, new { Id = userId });
    }
}
