namespace SynthiaDash.Api.Services;

/// <summary>
/// Local disk file storage. Saves to a configurable base path with siteKey/monthly subfolders.
/// Uses AppContext.BaseDirectory for IIS compatibility (not Directory.GetCurrentDirectory()).
/// Pattern from funtime-shared.
/// </summary>
public class LocalFileStorageService : IFileStorageService
{
    private readonly string _basePath;
    private readonly ILogger<LocalFileStorageService> _logger;

    public string StorageType => "local";

    public LocalFileStorageService(IConfiguration configuration, ILogger<LocalFileStorageService> logger)
    {
        _logger = logger;

        // Configurable base path — defaults to {AppBaseDir}/uploads
        // On IIS: AppContext.BaseDirectory = the actual app directory (reliable)
        // Do NOT use Directory.GetCurrentDirectory() (returns System32 on IIS)
        _basePath = configuration["Storage:LocalPath"]
            ?? Path.Combine(AppContext.BaseDirectory, "uploads");
    }

    public async Task<string> UploadFileAsync(Stream stream, string fileName, int assetId, string? siteKey = null)
    {
        var effectiveSiteKey = string.IsNullOrWhiteSpace(siteKey) ? "general" : siteKey;
        var monthFolder = DateTime.UtcNow.ToString("yyyy-MM");

        // Build path: basePath/siteKey/YYYY-MM/
        var uploadsPath = Path.Combine(_basePath, effectiveSiteKey, monthFolder);
        Directory.CreateDirectory(uploadsPath);

        // Filename: assetId.extension (no collisions, easy cleanup)
        var extension = Path.GetExtension(fileName)?.ToLowerInvariant() ?? ".bin";
        var savedFileName = $"{assetId}{extension}";
        var filePath = Path.Combine(uploadsPath, savedFileName);

        await using (var fs = new FileStream(filePath, FileMode.Create))
        {
            await stream.CopyToAsync(fs);
        }

        // Return relative storage URL: /siteKey/YYYY-MM/assetId.ext
        var relativeUrl = $"/{effectiveSiteKey}/{monthFolder}/{savedFileName}";
        _logger.LogInformation("Stored asset {AssetId} at {Path}", assetId, relativeUrl);
        return relativeUrl;
    }

    public Task DeleteFileAsync(string storageUrl)
    {
        if (string.IsNullOrEmpty(storageUrl)) return Task.CompletedTask;

        var filePath = ResolveFilePath(storageUrl);
        if (filePath != null && File.Exists(filePath))
        {
            File.Delete(filePath);
            CleanupEmptyDirectories(Path.GetDirectoryName(filePath));
            _logger.LogInformation("Deleted file at {Path}", storageUrl);
        }

        return Task.CompletedTask;
    }

    public Task<Stream?> GetFileStreamAsync(string storageUrl)
    {
        if (string.IsNullOrEmpty(storageUrl)) return Task.FromResult<Stream?>(null);

        var filePath = ResolveFilePath(storageUrl);
        if (filePath == null || !File.Exists(filePath)) return Task.FromResult<Stream?>(null);

        Stream stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task<bool> FileExistsAsync(string storageUrl)
    {
        if (string.IsNullOrEmpty(storageUrl)) return Task.FromResult(false);

        var filePath = ResolveFilePath(storageUrl);
        return Task.FromResult(filePath != null && File.Exists(filePath));
    }

    /// <summary>
    /// Resolve a storage URL to an absolute file path.
    /// StorageUrl format: /siteKey/YYYY-MM/assetId.ext
    /// </summary>
    private string? ResolveFilePath(string storageUrl)
    {
        // Strip leading slash and convert to OS path
        var relativePath = storageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(_basePath, relativePath);
    }

    /// <summary>
    /// Remove empty parent directories up to the base uploads path.
    /// </summary>
    private void CleanupEmptyDirectories(string? directoryPath)
    {
        if (string.IsNullOrEmpty(directoryPath)) return;

        try
        {
            while (!string.IsNullOrEmpty(directoryPath) &&
                   directoryPath.Length > _basePath.Length &&
                   Directory.Exists(directoryPath) &&
                   !Directory.EnumerateFileSystemEntries(directoryPath).Any())
            {
                Directory.Delete(directoryPath);
                directoryPath = Path.GetDirectoryName(directoryPath);
            }
        }
        catch
        {
            // Cleanup errors are non-critical
        }
    }
}
