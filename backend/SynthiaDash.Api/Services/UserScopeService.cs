using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IUserScopeService
{
    UserScope GetUserScope(string email);
    bool CanAccessRepo(string email, string repoName);
    bool IsAdmin(string email);
}

public class UserScopeService : IUserScopeService
{
    private readonly string? _connectionString;
    private readonly List<UserScope> _configScopes;

    public UserScopeService(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection");
        _configScopes = configuration.GetSection("UserScopes:users").Get<List<UserScope>>() ?? new();
    }

    public UserScope GetUserScope(string email)
    {
        if (string.IsNullOrEmpty(email))
            return new UserScope { Email = "", Role = "none", Repos = new() };

        // Try DB first
        if (!string.IsNullOrEmpty(_connectionString))
        {
            try
            {
                using var db = new SqlConnection(_connectionString);
                var user = db.QueryFirstOrDefault<DbUser>(
                    "SELECT Role, Repos FROM Users WHERE Email = @Email AND IsActive = 1",
                    new { Email = email });

                if (user != null)
                {
                    var repos = new List<string>();
                    if (user.Role == "admin")
                    {
                        repos.Add("*");
                    }
                    else if (!string.IsNullOrEmpty(user.Repos))
                    {
                        try
                        {
                            repos = JsonSerializer.Deserialize<List<string>>(user.Repos) ?? new();
                        }
                        catch { }
                    }

                    return new UserScope { Email = email, Role = user.Role, Repos = repos };
                }
            }
            catch { }
        }

        // Fall back to config
        return _configScopes.FirstOrDefault(s =>
            s.Email.Equals(email, StringComparison.OrdinalIgnoreCase))
            ?? new UserScope { Email = email, Role = "none", Repos = new() };
    }

    public bool CanAccessRepo(string email, string repoName)
    {
        var scope = GetUserScope(email);
        if (scope.Role == "none") return false;
        if (scope.Role == "admin" || scope.Repos.Contains("*")) return true;
        return scope.Repos.Any(r =>
            r.Equals(repoName, StringComparison.OrdinalIgnoreCase));
    }

    public bool IsAdmin(string email)
    {
        return GetUserScope(email).Role == "admin";
    }

    private class DbUser
    {
        public string Role { get; set; } = "viewer";
        public string? Repos { get; set; }
    }
}
