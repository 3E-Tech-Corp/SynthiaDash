using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IFeaturedProjectService
{
    Task<List<FeaturedProject>> GetAllAsync(bool? isActive = null);
    Task<FeaturedProject?> GetByIdAsync(int id);
    Task<FeaturedProject> CreateAsync(CreateFeaturedProjectRequest request);
    Task<FeaturedProject?> UpdateAsync(int id, UpdateFeaturedProjectRequest request);
    Task<bool> DeleteAsync(int id);
    Task SetThumbnailAssetIdAsync(int id, int assetId);
    Task ReorderAsync(List<ReorderItem> items);
}

public class FeaturedProjectService : IFeaturedProjectService
{
    private readonly string _connectionString;
    private readonly ILogger<FeaturedProjectService> _logger;

    public FeaturedProjectService(IConfiguration configuration, ILogger<FeaturedProjectService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _logger = logger;
    }

    public async Task<List<FeaturedProject>> GetAllAsync(bool? isActive = null)
    {
        using var db = new SqlConnection(_connectionString);

        var sql = "SELECT * FROM FeaturedProjects";
        if (isActive.HasValue)
            sql += " WHERE IsActive = @IsActive";
        sql += " ORDER BY SortOrder ASC, Id ASC";

        var results = await db.QueryAsync<FeaturedProject>(sql, new { IsActive = isActive });
        return results.ToList();
    }

    public async Task<FeaturedProject?> GetByIdAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<FeaturedProject>(
            "SELECT * FROM FeaturedProjects WHERE Id = @Id", new { Id = id });
    }

    public async Task<FeaturedProject> CreateAsync(CreateFeaturedProjectRequest request)
    {
        using var db = new SqlConnection(_connectionString);

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO FeaturedProjects (Title, Description, ProjectId, Url, SortOrder, IsActive)
              OUTPUT INSERTED.Id
              VALUES (@Title, @Description, @ProjectId, @Url, @SortOrder, @IsActive)",
            new
            {
                request.Title,
                request.Description,
                request.ProjectId,
                request.Url,
                request.SortOrder,
                request.IsActive
            });

        _logger.LogInformation("Created featured project {Id}: {Title}", id, request.Title);
        return (await GetByIdAsync(id))!;
    }

    public async Task<FeaturedProject?> UpdateAsync(int id, UpdateFeaturedProjectRequest request)
    {
        using var db = new SqlConnection(_connectionString);

        var updates = new List<string> { "UpdatedAt = GETUTCDATE()" };
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (request.Title != null)
        {
            updates.Add("Title = @Title");
            parameters.Add("Title", request.Title);
        }
        if (request.Description != null)
        {
            updates.Add("Description = @Description");
            parameters.Add("Description", request.Description);
        }
        if (request.ProjectId.HasValue)
        {
            updates.Add("ProjectId = @ProjectId");
            parameters.Add("ProjectId", request.ProjectId.Value == 0 ? (int?)null : request.ProjectId.Value);
        }
        if (request.Url != null)
        {
            updates.Add("Url = @Url");
            parameters.Add("Url", request.Url);
        }
        if (request.SortOrder.HasValue)
        {
            updates.Add("SortOrder = @SortOrder");
            parameters.Add("SortOrder", request.SortOrder.Value);
        }
        if (request.IsActive.HasValue)
        {
            updates.Add("IsActive = @IsActive");
            parameters.Add("IsActive", request.IsActive.Value);
        }

        var sql = $"UPDATE FeaturedProjects SET {string.Join(", ", updates)} WHERE Id = @Id";
        var affected = await db.ExecuteAsync(sql, parameters);

        if (affected == 0) return null;

        _logger.LogInformation("Updated featured project {Id}", id);
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        // Note: thumbnail asset cleanup should be handled by the caller (controller)
        // since the AssetService owns file deletion
        var affected = await db.ExecuteAsync("DELETE FROM FeaturedProjects WHERE Id = @Id", new { Id = id });
        return affected > 0;
    }

    public async Task SetThumbnailAssetIdAsync(int id, int assetId)
    {
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "UPDATE FeaturedProjects SET ThumbnailAssetId = @AssetId, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { AssetId = assetId, Id = id });
        _logger.LogInformation("Featured project {Id} linked to asset {AssetId}", id, assetId);
    }

    public async Task ReorderAsync(List<ReorderItem> items)
    {
        using var db = new SqlConnection(_connectionString);
        await db.OpenAsync();
        using var transaction = db.BeginTransaction();

        try
        {
            foreach (var item in items)
            {
                await db.ExecuteAsync(
                    "UPDATE FeaturedProjects SET SortOrder = @SortOrder, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
                    new { item.SortOrder, item.Id },
                    transaction);
            }

            transaction.Commit();
            _logger.LogInformation("Reordered {Count} featured projects", items.Count);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
}
