using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface ITicketService
{
    Task<Ticket> CreateTicketAsync(int userId, CreateTicketRequest request, string? imagePath);
    Task<Ticket?> GetTicketAsync(int id);
    Task<List<Ticket>> GetTicketsAsync(int? userId = null, int limit = 50);
    Task<Ticket?> UpdateTicketAsync(int id, UpdateTicketRequest request);
    Task<bool> DeleteTicketAsync(int id);
    Task<string> GetUserTicketAccessAsync(int userId);
}

public class TicketService : ITicketService
{
    private readonly string _connectionString;
    private readonly ILogger<TicketService> _logger;

    public TicketService(IConfiguration configuration, ILogger<TicketService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _logger = logger;
    }

    public async Task<Ticket> CreateTicketAsync(int userId, CreateTicketRequest request, string? imagePath)
    {
        using var db = new SqlConnection(_connectionString);

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO Tickets (UserId, Type, Title, Description, ImagePath, RepoFullName)
              OUTPUT INSERTED.Id
              VALUES (@UserId, @Type, @Title, @Description, @ImagePath, @RepoFullName)",
            new
            {
                UserId = userId,
                Type = request.Type,
                Title = request.Title,
                Description = request.Description,
                ImagePath = imagePath,
                RepoFullName = request.RepoFullName
            });

        return (await GetTicketAsync(id))!;
    }

    public async Task<Ticket?> GetTicketAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);

        return await db.QueryFirstOrDefaultAsync<Ticket>(
            @"SELECT t.*, u.Email AS UserEmail, u.DisplayName AS UserDisplayName
              FROM Tickets t
              JOIN Users u ON t.UserId = u.Id
              WHERE t.Id = @Id", new { Id = id });
    }

    public async Task<List<Ticket>> GetTicketsAsync(int? userId = null, int limit = 50)
    {
        using var db = new SqlConnection(_connectionString);

        var sql = @"SELECT TOP(@Limit) t.*, u.Email AS UserEmail, u.DisplayName AS UserDisplayName
                    FROM Tickets t
                    JOIN Users u ON t.UserId = u.Id";

        if (userId.HasValue)
            sql += " WHERE t.UserId = @UserId";

        sql += " ORDER BY t.CreatedAt DESC";

        var tickets = await db.QueryAsync<Ticket>(sql, new { Limit = limit, UserId = userId });
        return tickets.ToList();
    }

    public async Task<Ticket?> UpdateTicketAsync(int id, UpdateTicketRequest request)
    {
        using var db = new SqlConnection(_connectionString);

        var updates = new List<string> { "UpdatedAt = GETUTCDATE()" };
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (request.Status != null)
        {
            updates.Add("Status = @Status");
            parameters.Add("Status", request.Status);

            if (request.Status == "completed" || request.Status == "closed")
            {
                updates.Add("CompletedAt = GETUTCDATE()");
            }
        }

        if (request.Result != null)
        {
            updates.Add("Result = @Result");
            parameters.Add("Result", request.Result);
        }

        var sql = $"UPDATE Tickets SET {string.Join(", ", updates)} WHERE Id = @Id";
        var affected = await db.ExecuteAsync(sql, parameters);

        if (affected == 0) return null;
        return await GetTicketAsync(id);
    }

    public async Task<bool> DeleteTicketAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync("DELETE FROM Tickets WHERE Id = @Id", new { Id = id });
        return affected > 0;
    }

    public async Task<string> GetUserTicketAccessAsync(int userId)
    {
        using var db = new SqlConnection(_connectionString);
        var access = await db.QueryFirstOrDefaultAsync<string>(
            "SELECT TicketAccess FROM Users WHERE Id = @Id AND IsActive = 1",
            new { Id = userId });
        return access ?? "none";
    }
}
