using Dapper;
using Microsoft.Data.SqlClient;

namespace SynthiaDash.Api.Services;

public class SoulSnapshot
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SoulSnapshotListItem
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; }
}

public interface ISoulSnapshotService
{
    Task<IEnumerable<SoulSnapshotListItem>> GetPublishedAsync();
    Task<IEnumerable<SoulSnapshotListItem>> GetAllAsync();
    Task<SoulSnapshot?> GetByIdAsync(int id, bool publishedOnly = false);
    Task<SoulSnapshot?> GetLatestAsync();
    Task<SoulSnapshot> CreateAsync(SoulSnapshot snapshot);
    Task<bool> UpdateAsync(int id, SoulSnapshot snapshot);
    Task<bool> TogglePublishAsync(int id, bool isPublished);
    Task<bool> DeleteAsync(int id);
}

public class SoulSnapshotService : ISoulSnapshotService
{
    private readonly string _connectionString;

    public SoulSnapshotService(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
    }

    public async Task<IEnumerable<SoulSnapshotListItem>> GetPublishedAsync()
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryAsync<SoulSnapshotListItem>(
            "SELECT Id, [Date], Title, Summary, IsPublished, CreatedAt FROM SoulSnapshots WHERE IsPublished = 1 ORDER BY [Date] DESC");
    }

    public async Task<IEnumerable<SoulSnapshotListItem>> GetAllAsync()
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryAsync<SoulSnapshotListItem>(
            "SELECT Id, [Date], Title, Summary, IsPublished, CreatedAt FROM SoulSnapshots ORDER BY [Date] DESC");
    }

    public async Task<SoulSnapshot?> GetByIdAsync(int id, bool publishedOnly = false)
    {
        using var db = new SqlConnection(_connectionString);
        var sql = publishedOnly
            ? "SELECT Id, [Date], Title, Summary, Content, IsPublished, CreatedAt FROM SoulSnapshots WHERE Id = @Id AND IsPublished = 1"
            : "SELECT Id, [Date], Title, Summary, Content, IsPublished, CreatedAt FROM SoulSnapshots WHERE Id = @Id";
        return await db.QueryFirstOrDefaultAsync<SoulSnapshot>(sql, new { Id = id });
    }

    public async Task<SoulSnapshot?> GetLatestAsync()
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<SoulSnapshot>(
            "SELECT TOP 1 Id, [Date], Title, Summary, Content, IsPublished, CreatedAt FROM SoulSnapshots WHERE IsPublished = 1 ORDER BY [Date] DESC");
    }

    public async Task<SoulSnapshot> CreateAsync(SoulSnapshot snapshot)
    {
        using var db = new SqlConnection(_connectionString);
        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO SoulSnapshots ([Date], Title, Summary, Content, IsPublished)
              VALUES (@Date, @Title, @Summary, @Content, @IsPublished);
              SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new { snapshot.Date, snapshot.Title, snapshot.Summary, snapshot.Content, snapshot.IsPublished });
        snapshot.Id = id;
        return snapshot;
    }

    public async Task<bool> UpdateAsync(int id, SoulSnapshot snapshot)
    {
        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync(
            @"UPDATE SoulSnapshots SET [Date] = @Date, Title = @Title, Summary = @Summary, Content = @Content, IsPublished = @IsPublished
              WHERE Id = @Id",
            new { Id = id, snapshot.Date, snapshot.Title, snapshot.Summary, snapshot.Content, snapshot.IsPublished });
        return rows > 0;
    }

    public async Task<bool> TogglePublishAsync(int id, bool isPublished)
    {
        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync(
            "UPDATE SoulSnapshots SET IsPublished = @IsPublished WHERE Id = @Id",
            new { Id = id, IsPublished = isPublished });
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        var rows = await db.ExecuteAsync("DELETE FROM SoulSnapshots WHERE Id = @Id", new { Id = id });
        return rows > 0;
    }
}
