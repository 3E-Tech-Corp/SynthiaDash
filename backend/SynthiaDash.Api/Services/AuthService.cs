using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace SynthiaDash.Api.Services;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string email, string password);
    Task<AuthResult> RegisterAsync(string email, string displayName, string password, string role = "viewer", string? phoneNumber = null);
    Task<UserDto?> GetUserByEmailAsync(string email);
    Task<List<UserDto>> GetAllUsersAsync();
    Task<bool> UpdateUserAsync(int id, string? role, string? repos, bool? isActive,
        string? ticketAccess = null, string? bugAccess = null, string? featureAccess = null,
        string? chatAccess = null, int? maxProjects = null);
    Task<bool> UpdateLastLoginAsync(string email);
    Task<bool> ChangePasswordAsync(int userId, string currentPassword, string newPassword);
    Task<bool> ResetPasswordAsync(int userId, string newPassword);
    Task<AuthResult> RefreshAsync(string refreshToken);
    Task<bool> RevokeRefreshTokenAsync(string token);
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? Token { get; set; }
    public string? RefreshToken { get; set; }
    public string? Error { get; set; }
    public UserDto? User { get; set; }
}

public class UserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = "viewer";
    public string? Repos { get; set; }
    public string TicketAccess { get; set; } = "none"; // legacy
    public string BugAccess { get; set; } = "none";
    public string FeatureAccess { get; set; } = "none";
    public string ChatAccess { get; set; } = "none";
    public int MaxProjects { get; set; } = 1;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class AuthService : IAuthService
{
    private readonly string _connectionString;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IConfiguration configuration, ILogger<AuthService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        try
        {
            using var db = new SqlConnection(_connectionString);

            var user = await db.QueryFirstOrDefaultAsync<UserRecord>(
                "SELECT * FROM Users WHERE Email = @Email AND IsActive = 1", new { Email = email });

            if (user == null)
                return new AuthResult { Success = false, Error = "Invalid email or password" };

            if (!VerifyPassword(password, user.PasswordHash))
                return new AuthResult { Success = false, Error = "Invalid email or password" };

            await UpdateLastLoginAsync(email);

            var token = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken();
            await SaveRefreshTokenAsync(user.Id, refreshToken, DateTime.UtcNow.AddDays(30));

            return new AuthResult
            {
                Success = true,
                Token = token,
                RefreshToken = refreshToken,
                User = MapToDto(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for {Email}", email);
            return new AuthResult { Success = false, Error = "Login failed" };
        }
    }

    public async Task<AuthResult> RegisterAsync(string email, string displayName, string password, string role = "viewer", string? phoneNumber = null)
    {
        try
        {
            using var db = new SqlConnection(_connectionString);

            // Check if user exists
            var existing = await db.QueryFirstOrDefaultAsync<int?>(
                "SELECT Id FROM Users WHERE Email = @Email", new { Email = email });

            if (existing.HasValue)
                return new AuthResult { Success = false, Error = "Email already registered" };

            var passwordHash = HashPassword(password);

            // Determine membership type based on role
            var membershipType = (role == "free") ? "free" : "developer";

            var id = await db.QuerySingleAsync<int>(
                @"INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MembershipType, PhoneNumber, EmailVerified) 
                  OUTPUT INSERTED.Id
                  VALUES (@Email, @DisplayName, @PasswordHash, @Role, @MembershipType, @PhoneNumber, 0)",
                new { Email = email, DisplayName = displayName, PasswordHash = passwordHash, Role = role, MembershipType = membershipType, PhoneNumber = phoneNumber });

            var user = await db.QueryFirstAsync<UserRecord>(
                "SELECT * FROM Users WHERE Id = @Id", new { Id = id });

            var token = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken();
            await SaveRefreshTokenAsync(user.Id, refreshToken, DateTime.UtcNow.AddDays(30));

            return new AuthResult
            {
                Success = true,
                Token = token,
                RefreshToken = refreshToken,
                User = MapToDto(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration failed for {Email}", email);
            return new AuthResult { Success = false, Error = "Registration failed" };
        }
    }

    public async Task<UserDto?> GetUserByEmailAsync(string email)
    {
        using var db = new SqlConnection(_connectionString);
        var user = await db.QueryFirstOrDefaultAsync<UserRecord>(
            "SELECT * FROM Users WHERE Email = @Email", new { Email = email });
        return user != null ? MapToDto(user) : null;
    }

    public async Task<List<UserDto>> GetAllUsersAsync()
    {
        using var db = new SqlConnection(_connectionString);
        var users = await db.QueryAsync<UserRecord>("SELECT * FROM Users ORDER BY CreatedAt DESC");
        return users.Select(MapToDto).ToList();
    }

    public async Task<bool> UpdateUserAsync(int id, string? role, string? repos, bool? isActive,
        string? ticketAccess = null, string? bugAccess = null, string? featureAccess = null,
        string? chatAccess = null, int? maxProjects = null)
    {
        using var db = new SqlConnection(_connectionString);
        var updates = new List<string>();
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (role != null) { updates.Add("Role = @Role"); parameters.Add("Role", role); }
        if (repos != null) { updates.Add("Repos = @Repos"); parameters.Add("Repos", repos); }
        if (isActive.HasValue) { updates.Add("IsActive = @IsActive"); parameters.Add("IsActive", isActive.Value); }
        if (ticketAccess != null) { updates.Add("TicketAccess = @TicketAccess"); parameters.Add("TicketAccess", ticketAccess); }
        if (bugAccess != null) { updates.Add("BugAccess = @BugAccess"); parameters.Add("BugAccess", bugAccess); }
        if (featureAccess != null) { updates.Add("FeatureAccess = @FeatureAccess"); parameters.Add("FeatureAccess", featureAccess); }
        if (chatAccess != null) { updates.Add("ChatAccess = @ChatAccess"); parameters.Add("ChatAccess", chatAccess); }
        if (maxProjects.HasValue) { updates.Add("MaxProjects = @MaxProjects"); parameters.Add("MaxProjects", maxProjects.Value); }

        if (updates.Count == 0) return false;

        var sql = $"UPDATE Users SET {string.Join(", ", updates)} WHERE Id = @Id";
        var affected = await db.ExecuteAsync(sql, parameters);
        return affected > 0;
    }

    public async Task<bool> UpdateLastLoginAsync(string email)
    {
        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync(
            "UPDATE Users SET LastLoginAt = GETUTCDATE() WHERE Email = @Email", new { Email = email });
        return affected > 0;
    }

    public async Task<bool> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        using var db = new SqlConnection(_connectionString);
        var user = await db.QueryFirstOrDefaultAsync<UserRecord>(
            "SELECT * FROM Users WHERE Id = @Id", new { Id = userId });

        if (user == null) return false;
        if (!VerifyPassword(currentPassword, user.PasswordHash)) return false;

        var newHash = HashPassword(newPassword);
        var affected = await db.ExecuteAsync(
            "UPDATE Users SET PasswordHash = @Hash WHERE Id = @Id",
            new { Hash = newHash, Id = userId });
        return affected > 0;
    }

    public async Task<bool> ResetPasswordAsync(int userId, string newPassword)
    {
        using var db = new SqlConnection(_connectionString);
        var newHash = HashPassword(newPassword);
        var affected = await db.ExecuteAsync(
            "UPDATE Users SET PasswordHash = @Hash WHERE Id = @Id",
            new { Hash = newHash, Id = userId });
        return affected > 0;
    }

    private string GenerateJwtToken(UserRecord user)
    {
        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "SynthiaDash";
        var audience = _configuration["Jwt:Audience"] ?? "SynthiaDashUsers";

        var claims = new[]
        {
            new Claim("email", user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("userId", user.Id.ToString())
        };

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }

    private async Task SaveRefreshTokenAsync(int userId, string token, DateTime expiresAt)
    {
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"INSERT INTO RefreshTokens (UserId, Token, ExpiresAt) 
              VALUES (@UserId, @Token, @ExpiresAt)",
            new { UserId = userId, Token = token, ExpiresAt = expiresAt });
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken)
    {
        try
        {
            using var db = new SqlConnection(_connectionString);

            var stored = await db.QueryFirstOrDefaultAsync<RefreshTokenRecord>(
                @"SELECT rt.*, u.Email, u.DisplayName, u.Role, u.IsActive
                  FROM RefreshTokens rt
                  JOIN Users u ON u.Id = rt.UserId
                  WHERE rt.Token = @Token AND rt.RevokedAt IS NULL",
                new { Token = refreshToken });

            if (stored == null)
                return new AuthResult { Success = false, Error = "Invalid refresh token" };

            if (stored.ExpiresAt < DateTime.UtcNow)
                return new AuthResult { Success = false, Error = "Refresh token expired" };

            if (!stored.IsActive)
                return new AuthResult { Success = false, Error = "User account is inactive" };

            // Generate new tokens
            var user = await db.QueryFirstAsync<UserRecord>(
                "SELECT * FROM Users WHERE Id = @Id", new { Id = stored.UserId });

            var newJwt = GenerateJwtToken(user);
            var newRefreshToken = GenerateRefreshToken();

            // Revoke old token and save new one (rotation)
            await db.ExecuteAsync(
                @"UPDATE RefreshTokens SET RevokedAt = GETUTCDATE(), ReplacedByToken = @NewToken
                  WHERE Token = @OldToken",
                new { OldToken = refreshToken, NewToken = newRefreshToken });

            await SaveRefreshTokenAsync(stored.UserId, newRefreshToken, DateTime.UtcNow.AddDays(30));

            return new AuthResult
            {
                Success = true,
                Token = newJwt,
                RefreshToken = newRefreshToken,
                User = MapToDto(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token refresh failed");
            return new AuthResult { Success = false, Error = "Token refresh failed" };
        }
    }

    public async Task<bool> RevokeRefreshTokenAsync(string token)
    {
        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync(
            "UPDATE RefreshTokens SET RevokedAt = GETUTCDATE() WHERE Token = @Token AND RevokedAt IS NULL",
            new { Token = token });
        return affected > 0;
    }

    // Simple PBKDF2 password hashing (no BCrypt dependency needed)
    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split('.');
        if (parts.Length != 2) return false;

        var salt = Convert.FromBase64String(parts[0]);
        var expectedHash = Convert.FromBase64String(parts[1]);

        var actualHash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 100_000, HashAlgorithmName.SHA256, 32);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static UserDto MapToDto(UserRecord user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Role = user.Role,
        Repos = user.Repos,
        TicketAccess = user.TicketAccess,
        BugAccess = user.BugAccess,
        FeatureAccess = user.FeatureAccess,
        ChatAccess = user.ChatAccess,
        MaxProjects = user.MaxProjects,
        IsActive = user.IsActive,
        CreatedAt = user.CreatedAt,
        LastLoginAt = user.LastLoginAt
    };

    private class UserRecord
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "viewer";
        public string? Repos { get; set; }
        public string TicketAccess { get; set; } = "none";
        public string BugAccess { get; set; } = "none";
        public string FeatureAccess { get; set; } = "none";
        public string ChatAccess { get; set; } = "none";
        public int MaxProjects { get; set; } = 1;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }

    private class RefreshTokenRecord
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? ReplacedByToken { get; set; }
        // Joined from Users
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
