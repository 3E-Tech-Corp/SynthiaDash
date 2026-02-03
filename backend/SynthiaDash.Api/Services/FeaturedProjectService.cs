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
    Task<string> SaveThumbnailAsync(int id, Stream fileStream, string fileName, string contentType);
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

        // Also delete thumbnail file if exists
        var project = await GetByIdAsync(id);
        if (project?.ThumbnailPath != null)
        {
            try
            {
                var basePath = AppContext.BaseDirectory;
                var fullPath = Path.Combine(basePath, "wwwroot", project.ThumbnailPath.TrimStart('/'));
                if (File.Exists(fullPath))
                    File.Delete(fullPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete thumbnail for featured project {Id}", id);
            }
        }

        var affected = await db.ExecuteAsync("DELETE FROM FeaturedProjects WHERE Id = @Id", new { Id = id });
        return affected > 0;
    }

    public async Task<string> SaveThumbnailAsync(int id, Stream fileStream, string fileName, string contentType)
    {
        var basePath = AppContext.BaseDirectory;
        var uploadsPath = Path.Combine(basePath, "wwwroot", "uploads", "featured");
        Directory.CreateDirectory(uploadsPath);

        var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
        if (string.IsNullOrEmpty(extension))
        {
            extension = contentType?.ToLowerInvariant() switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/gif" => ".gif",
                "image/webp" => ".webp",
                _ => ".jpg"
            };
        }

        var savedFileName = $"featured_{id}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadsPath, savedFileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await fileStream.CopyToAsync(stream);
        }

        var relativePath = $"/uploads/featured/{savedFileName}";

        // Update DB with thumbnail path
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "UPDATE FeaturedProjects SET ThumbnailPath = @Path, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Path = relativePath, Id = id });

        _logger.LogInformation("Saved thumbnail for featured project {Id}: {Path}", id, relativePath);
        return relativePath;
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
