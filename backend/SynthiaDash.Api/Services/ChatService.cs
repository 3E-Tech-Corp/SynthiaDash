using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IChatService
{
    Task<string> GetUserChatAccess(int userId);
    string BuildSessionKey(int userId, string? projectSlug);
    string BuildSystemPrompt(string tier, string? projectName, string? repoFullName, string? projectBrief);
    Task SaveMessage(int userId, string sessionKey, string role, string content);
    Task<List<ChatMessage>> GetHistory(int userId, string sessionKey, int limit = 50);
    Task ClearHistory(int userId, string sessionKey);
}

public class ChatService : IChatService
{
    private readonly string _connectionString;
    private readonly ILogger<ChatService> _logger;

    public ChatService(IConfiguration configuration, ILogger<ChatService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _logger = logger;
    }

    public async Task<string> GetUserChatAccess(int userId)
    {
        using var db = new SqlConnection(_connectionString);
        var access = await db.QueryFirstOrDefaultAsync<string>(
            "SELECT ChatAccess FROM Users WHERE Id = @Id", new { Id = userId });
        return access ?? "none";
    }

    public string BuildSessionKey(int userId, string? projectSlug)
    {
        var slug = string.IsNullOrEmpty(projectSlug) ? "default" : projectSlug;
        return $"dash:{userId}:{slug}";
    }

    public string BuildSystemPrompt(string tier, string? projectName, string? repoFullName, string? projectBrief)
    {
        var briefSection = !string.IsNullOrWhiteSpace(projectBrief)
            ? $"\nProject Vision:\n{projectBrief}\n"
            : "";

        var project = projectName ?? "your project";
        var repo = repoFullName ?? "your repository";

        return tier switch
        {
            "guide" => $"""
                You are Synthia, an AI assistant for the {project} project.
                Repository: {repo}

                Your role: Help the user understand their project. Answer questions about features, code structure, and how to use the application.

                Rules:
                - You can ONLY discuss the repository: {repo}
                - You cannot modify files, create tickets, or run commands
                - You have NO access to other projects, users, or system configuration
                - If asked to do something outside your scope, politely explain your access level
                - Be helpful, concise, and reference specific code when possible
                {briefSection}
                """,

            "bug" => $"""
                You are Synthia, an AI assistant for the {project} project.
                Repository: {repo}

                Your role: Help the user understand their project AND investigate bugs. When a user describes a problem, investigate the code, ask clarifying questions, and help document the issue.

                Rules:
                - You can read files from the repository: {repo}
                - You can help document and investigate bugs
                - You CANNOT modify code or create feature requests
                - You have NO access to other projects, users, or system configuration
                - Before documenting a bug, confirm details with the user
                - Include: steps to reproduce, expected vs actual behavior, relevant code references
                {briefSection}
                """,

            "developer" => $"""
                You are Synthia, an AI development assistant for the {project} project.
                Repository: {repo}

                Your role: Full development assistant. Investigate bugs, implement features, write code, and help with the project.

                Rules:
                - You can read AND write files in the repository: {repo}
                - You can help with code changes, bug fixes, and feature implementation
                - You CANNOT access other projects, users, or system configuration
                - You CANNOT access personal files, admin functions, or messaging
                - Always explain what you're doing before making changes
                - Write clean, well-documented code
                {briefSection}
                """,

            _ => "You are Synthia, a helpful AI assistant."
        };
    }

    public async Task SaveMessage(int userId, string sessionKey, string role, string content)
    {
        try
        {
            using var db = new SqlConnection(_connectionString);
            await db.ExecuteAsync(
                @"INSERT INTO ChatMessages (UserId, SessionKey, Role, Content)
                  VALUES (@UserId, @SessionKey, @Role, @Content)",
                new { UserId = userId, SessionKey = sessionKey, Role = role, Content = content });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save chat message for user {UserId}", userId);
        }
    }

    public async Task<List<ChatMessage>> GetHistory(int userId, string sessionKey, int limit = 50)
    {
        using var db = new SqlConnection(_connectionString);
        var messages = await db.QueryAsync<ChatMessage>(
            @"SELECT TOP (@Limit) Id, UserId, SessionKey, Role, Content, CreatedAt
              FROM ChatMessages
              WHERE UserId = @UserId AND SessionKey = @SessionKey
              ORDER BY CreatedAt DESC",
            new { UserId = userId, SessionKey = sessionKey, Limit = limit });

        // Reverse so oldest first
        return messages.Reverse().ToList();
    }

    public async Task ClearHistory(int userId, string sessionKey)
    {
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "DELETE FROM ChatMessages WHERE UserId = @UserId AND SessionKey = @SessionKey",
            new { UserId = userId, SessionKey = sessionKey });
    }
}
