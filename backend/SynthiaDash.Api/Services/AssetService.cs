using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IAssetService
{
    Task<Asset?> GetByIdAsync(int id);
    Task<Asset> CreateAsync(Asset asset);
    Task UpdateStorageUrlAsync(int id, string storageUrl);
    Task<bool> DeleteAsync(int id);
}

/// <summary>
/// Asset DB operations via Dapper (consistent with SynthiaDash's data access pattern).
/// Pattern from funtime-shared — insert first to get ID, then upload file named by ID.
/// </summary>
public class AssetService : IAssetService
{
    private readonly string _connectionString;
    private readonly IFileStorageService _storageService;
    private readonly ILogger<AssetService> _logger;

    public AssetService(IConfiguration configuration, IFileStorageService storageService, ILogger<AssetService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _storageService = storageService;
        _logger = logger;
    }

    public async Task<Asset?> GetByIdAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<Asset>(
            "SELECT * FROM Assets WHERE Id = @Id", new { Id = id });
    }

    public async Task<Asset> CreateAsync(Asset asset)
    {
        using var db = new SqlConnection(_connectionString);
        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO Assets (AssetType, FileName, ContentType, FileSize, StorageUrl, ExternalUrl, ThumbnailUrl, StorageType, Category, SiteKey, UploadedBy, IsPublic)
              OUTPUT INSERTED.Id
              VALUES (@AssetType, @FileName, @ContentType, @FileSize, @StorageUrl, @ExternalUrl, @ThumbnailUrl, @StorageType, @Category, @SiteKey, @UploadedBy, @IsPublic)",
            asset);

        asset.Id = id;
        _logger.LogInformation("Created asset {AssetId} ({AssetType}): {FileName}", id, asset.AssetType, asset.FileName);
        return asset;
    }

    public async Task UpdateStorageUrlAsync(int id, string storageUrl)
    {
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "UPDATE Assets SET StorageUrl = @StorageUrl WHERE Id = @Id",
            new { StorageUrl = storageUrl, Id = id });
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var asset = await GetByIdAsync(id);
        if (asset == null) return false;

        // Delete file from storage
        if (!string.IsNullOrEmpty(asset.StorageUrl) && asset.StorageType != "external")
        {
            try
            {
                await _storageService.DeleteFileAsync(asset.StorageUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete storage for asset {AssetId}", id);
            }
        }

        // Delete DB record
        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync("DELETE FROM Assets WHERE Id = @Id", new { Id = id });
        return affected > 0;
    }
}
