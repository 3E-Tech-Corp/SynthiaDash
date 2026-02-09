using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IFeedbackService
{
    Task<Feedback> CreateAsync(FeedbackCreateDto dto);
    Task<List<FeedbackPublicDto>> GetApprovedPublicAsync(int limit = 20);
    Task<List<Feedback>> GetAllAsync();
    Task<bool> ApproveAsync(int id);
    Task<bool> DeleteAsync(int id);
}

public class FeedbackService : IFeedbackService
{
    private readonly string _connectionString;
    private readonly ILogger<FeedbackService> _logger;

    public FeedbackService(IConfiguration configuration, ILogger<FeedbackService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _logger = logger;
    }

    public async Task<Feedback> CreateAsync(FeedbackCreateDto dto)
    {
        using var db = new SqlConnection(_connectionString);
        
        var feedback = new Feedback
        {
            Name = dto.Name.Trim(),
            Email = dto.Email?.Trim(),
            Message = dto.Message.Trim(),
            Organization = dto.Organization?.Trim(),
            IsApproved = false,
            IsPublic = dto.AllowPublic,
            CreatedAt = DateTime.UtcNow
        };

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO GoodAiFeedback (Name, Email, Message, Organization, IsApproved, IsPublic, CreatedAt)
              OUTPUT INSERTED.Id
              VALUES (@Name, @Email, @Message, @Organization, @IsApproved, @IsPublic, @CreatedAt)",
            feedback);

        feedback.Id = id;
        _logger.LogInformation("New Good AI feedback from {Name}: {Message}", feedback.Name, feedback.Message.Substring(0, Math.Min(50, feedback.Message.Length)));
        
        return feedback;
    }

    public async Task<List<FeedbackPublicDto>> GetApprovedPublicAsync(int limit = 20)
    {
        using var db = new SqlConnection(_connectionString);
        var results = await db.QueryAsync<FeedbackPublicDto>(
            @"SELECT TOP (@Limit) Id, Name, Organization, Message, CreatedAt 
              FROM GoodAiFeedback 
              WHERE IsApproved = 1 AND IsPublic = 1
              ORDER BY CreatedAt DESC",
            new { Limit = limit });
        return results.ToList();
    }

    public async Task<List<Feedback>> GetAllAsync()
    {
        using var db = new SqlConnection(_connectionString);
        var results = await db.QueryAsync<Feedback>(
            "SELECT * FROM GoodAiFeedback ORDER BY CreatedAt DESC");
        return results.ToList();
    }

    public async Task<bool> ApproveAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync(
            "UPDATE GoodAiFeedback SET IsApproved = 1 WHERE Id = @Id",
            new { Id = id });
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync(
            "DELETE FROM GoodAiFeedback WHERE Id = @Id",
            new { Id = id });
        return rows > 0;
    }
}
