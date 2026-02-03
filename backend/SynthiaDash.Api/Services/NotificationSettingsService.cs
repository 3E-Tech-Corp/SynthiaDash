using Dapper;
using Microsoft.Data.SqlClient;

namespace SynthiaDash.Api.Services;

public interface INotificationSettingsService
{
    Task<List<NotificationSetting>> GetAllAsync();
    Task<NotificationSetting?> GetByEventCodeAsync(string eventCode);
    Task<NotificationSetting?> UpdateAsync(int id, string? taskCode, bool isEnabled);
}

public class NotificationSettingsService : INotificationSettingsService
{
    private readonly string _connectionString;
    private readonly ILogger<NotificationSettingsService> _logger;

    public NotificationSettingsService(IConfiguration configuration, ILogger<NotificationSettingsService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _logger = logger;
    }

    public async Task<List<NotificationSetting>> GetAllAsync()
    {
        using var db = new SqlConnection(_connectionString);
        var results = await db.QueryAsync<NotificationSetting>(
            "SELECT * FROM NotificationSettings ORDER BY EventCode");
        return results.AsList();
    }

    public async Task<NotificationSetting?> GetByEventCodeAsync(string eventCode)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<NotificationSetting>(
            "SELECT * FROM NotificationSettings WHERE EventCode = @EventCode",
            new { EventCode = eventCode });
    }

    public async Task<NotificationSetting?> UpdateAsync(int id, string? taskCode, bool isEnabled)
    {
        using var db = new SqlConnection(_connectionString);
        var rowsAffected = await db.ExecuteAsync(
            @"UPDATE NotificationSettings 
              SET TaskCode = @TaskCode, IsEnabled = @IsEnabled, UpdatedAt = GETUTCDATE()
              WHERE Id = @Id",
            new { Id = id, TaskCode = taskCode, IsEnabled = isEnabled });

        if (rowsAffected == 0) return null;

        return await db.QueryFirstOrDefaultAsync<NotificationSetting>(
            "SELECT * FROM NotificationSettings WHERE Id = @Id",
            new { Id = id });
    }
}

public class NotificationSetting
{
    public int Id { get; set; }
    public string EventCode { get; set; } = "";
    public string EventName { get; set; } = "";
    public string? TaskCode { get; set; }
    public bool IsEnabled { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
