namespace SynthiaDash.Api.Models;

/// <summary>
/// Asset types for categorizing content
/// </summary>
public static class AssetTypes
{
    public const string Image = "image";
    public const string Video = "video";
    public const string Document = "document";
    public const string Audio = "audio";
    public const string Link = "link";
}

/// <summary>
/// Represents an uploaded asset or external link.
/// Pattern from funtime-shared: files named by asset ID, served via controller endpoint.
/// </summary>
public class Asset
{
    public int Id { get; set; }

    /// <summary>image, video, document, audio, link</summary>
    public string AssetType { get; set; } = AssetTypes.Image;

    /// <summary>Original filename (uploads) or title (links)</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME type (e.g., image/png, video/mp4)</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>File size in bytes (0 for external links)</summary>
    public long FileSize { get; set; }

    /// <summary>Storage path (local relative path or S3 URL)</summary>
    public string StorageUrl { get; set; } = string.Empty;

    /// <summary>External URL for linked assets (YouTube, Vimeo, etc.)</summary>
    public string? ExternalUrl { get; set; }

    /// <summary>Thumbnail URL for videos or external content</summary>
    public string? ThumbnailUrl { get; set; }

    /// <summary>Storage backend: "local", "s3", or "external"</summary>
    public string StorageType { get; set; } = "local";

    /// <summary>Organizational category (e.g., "logos", "featured", "avatars")</summary>
    public string? Category { get; set; }

    /// <summary>Site key for multi-tenant organization</summary>
    public string? SiteKey { get; set; }

    /// <summary>User who uploaded the asset</summary>
    public int? UploadedBy { get; set; }

    /// <summary>Whether the asset is publicly accessible without auth</summary>
    public bool IsPublic { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ── DTOs ──

public class AssetUploadResponse
{
    public bool Success { get; set; }
    public int AssetId { get; set; }
    public string AssetType { get; set; } = "image";
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? ExternalUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
}

public class AssetInfoResponse
{
    public int Id { get; set; }
    public string AssetType { get; set; } = "image";
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Category { get; set; }
    public string? ExternalUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public bool IsPublic { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Url { get; set; } = string.Empty;
}

public class Base64UploadRequest
{
    /// <summary>Base64-encoded image data, optionally with data URL prefix</summary>
    public string ImageData { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? AssetType { get; set; }
    public string? Category { get; set; }
    public string? SiteKey { get; set; }
    public bool IsPublic { get; set; } = true;
}

public class RegisterLinkRequest
{
    public string Url { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? AssetType { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Category { get; set; }
    public string? SiteKey { get; set; }
    public bool IsPublic { get; set; } = true;
}
