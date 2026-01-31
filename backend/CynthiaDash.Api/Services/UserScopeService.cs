using CynthiaDash.Api.Models;

namespace CynthiaDash.Api.Services;

public interface IUserScopeService
{
    UserScope GetUserScope(string email);
    bool CanAccessRepo(string email, string repoName);
    bool IsAdmin(string email);
}

public class UserScopeService : IUserScopeService
{
    private readonly List<UserScope> _scopes;

    public UserScopeService(IConfiguration configuration)
    {
        _scopes = configuration.GetSection("UserScopes:users").Get<List<UserScope>>() ?? new();
    }

    public UserScope GetUserScope(string email)
    {
        return _scopes.FirstOrDefault(s =>
            s.Email.Equals(email, StringComparison.OrdinalIgnoreCase))
            ?? new UserScope { Email = email, Role = "none", Repos = new() };
    }

    public bool CanAccessRepo(string email, string repoName)
    {
        var scope = GetUserScope(email);
        if (scope.Role == "none") return false;
        if (scope.Repos.Contains("*")) return true;
        return scope.Repos.Any(r =>
            r.Equals(repoName, StringComparison.OrdinalIgnoreCase));
    }

    public bool IsAdmin(string email)
    {
        return GetUserScope(email).Role == "admin";
    }
}
