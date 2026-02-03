namespace SynthiaDash.Api.Services;

/// <summary>
/// Abstraction for file storage (local disk or S3).
/// Pattern from funtime-shared: files named by asset ID, monthly subfolders, siteKey organization.
/// </summary>
public interface IFileStorageService
{
    /// <summary>Storage type identifier ("local" or "s3")</summary>
    string StorageType { get; }

    /// <summary>
    /// Upload a file with asset ID as the filename.
    /// Path structure: {siteKey}/{YYYY-MM}/{assetId}.{extension}
    /// </summary>
    Task<string> UploadFileAsync(Stream stream, string fileName, int assetId, string? siteKey = null);

    /// <summary>Delete a file from storage</summary>
    Task DeleteFileAsync(string storageUrl);

    /// <summary>Get a file stream for serving</summary>
    Task<Stream?> GetFileStreamAsync(string storageUrl);

    /// <summary>Check if a file exists</summary>
    Task<bool> FileExistsAsync(string storageUrl);
}
