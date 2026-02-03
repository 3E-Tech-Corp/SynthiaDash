using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

/// <summary>
/// Asset management controller following the funtime-shared pattern.
/// - POST /asset/upload        — multipart file upload
/// - POST /asset/upload-base64 — base64 JSON body (Cloudflare WAF safe)
/// - POST /asset/link          — register external URL as asset
/// - GET  /asset/{id}          — serve file (canonical URL for all assets)
/// - GET  /asset/{id}/info     — metadata only
/// - DELETE /asset/{id}        — delete file + record
///
/// Key design: frontend ALWAYS uses /asset/{id} to reference files.
/// Never expose raw storage paths to the client.
/// </summary>
[ApiController]
[Route("[controller]")]
public class AssetController : ControllerBase
{
    private readonly IAssetService _assetService;
    private readonly IFileStorageService _storageService;
    private readonly ILogger<AssetController> _logger;

    // Allowed MIME types with hardcoded fallback (no DB-driven AssetFileTypes for now)
    private static readonly Dictionary<string, (string Category, int MaxSizeMB)> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ("image", 10),
        ["image/png"] = ("image", 10),
        ["image/gif"] = ("image", 10),
        ["image/webp"] = ("image", 10),
        ["image/svg+xml"] = ("image", 10),
        ["video/mp4"] = ("video", 100),
        ["video/webm"] = ("video", 100),
        ["video/quicktime"] = ("video", 100),
        ["audio/mpeg"] = ("audio", 10),
        ["audio/wav"] = ("audio", 10),
        ["application/pdf"] = ("document", 10),
    };

    public AssetController(
        IAssetService assetService,
        IFileStorageService storageService,
        ILogger<AssetController> logger)
    {
        _assetService = assetService;
        _storageService = storageService;
        _logger = logger;
    }

    /// <summary>
    /// Upload a file via multipart form data.
    /// </summary>
    [HttpPost("upload")]
    [Authorize]
    [RequestSizeLimit(150 * 1024 * 1024)]
    public async Task<ActionResult<AssetUploadResponse>> Upload(
        IFormFile file,
        [FromQuery] string? category = null,
        [FromQuery] string? siteKey = null,
        [FromQuery] bool isPublic = true)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        var contentType = file.ContentType.ToLowerInvariant();
        if (!AllowedTypes.TryGetValue(contentType, out var typeInfo))
            return BadRequest(new { error = $"File type '{contentType}' is not allowed." });

        if (file.Length > typeInfo.MaxSizeMB * 1024 * 1024)
            return BadRequest(new { error = $"File size must be less than {typeInfo.MaxSizeMB}MB for {typeInfo.Category} files." });

        var userId = GetCurrentUserId();

        // Step 1: Create asset record to get ID
        var asset = new Asset
        {
            AssetType = typeInfo.Category,
            FileName = file.FileName,
            ContentType = contentType,
            FileSize = file.Length,
            StorageUrl = string.Empty,
            StorageType = _storageService.StorageType,
            Category = category,
            SiteKey = siteKey,
            UploadedBy = userId,
            IsPublic = isPublic
        };
        asset = await _assetService.CreateAsync(asset);

        // Step 2: Upload file named by asset ID
        using var stream = file.OpenReadStream();
        var storageUrl = await _storageService.UploadFileAsync(stream, file.FileName, asset.Id, siteKey);

        // Step 3: Update record with storage URL
        await _assetService.UpdateStorageUrlAsync(asset.Id, storageUrl);

        return Ok(new AssetUploadResponse
        {
            Success = true,
            AssetId = asset.Id,
            AssetType = asset.AssetType,
            FileName = asset.FileName,
            ContentType = asset.ContentType,
            FileSize = asset.FileSize,
            Url = $"/asset/{asset.Id}"
        });
    }

    /// <summary>
    /// Upload a file via base64-encoded JSON body.
    /// Avoids Cloudflare WAF blocking large multipart uploads.
    /// </summary>
    [HttpPost("upload-base64")]
    [Authorize]
    public async Task<ActionResult<AssetUploadResponse>> UploadBase64([FromBody] Base64UploadRequest request)
    {
        if (string.IsNullOrEmpty(request.ImageData))
            return BadRequest(new { error = "No image data provided." });

        // Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
        string base64Data;
        string contentType = "image/jpeg";

        if (request.ImageData.StartsWith("data:"))
        {
            var commaIdx = request.ImageData.IndexOf(',');
            if (commaIdx < 0)
                return BadRequest(new { error = "Invalid data URL format." });

            var header = request.ImageData[..commaIdx];
            base64Data = request.ImageData[(commaIdx + 1)..];

            var mimeEnd = header.IndexOf(';');
            if (mimeEnd > 5)
                contentType = header[5..mimeEnd];
        }
        else
        {
            base64Data = request.ImageData;
        }

        if (!AllowedTypes.TryGetValue(contentType, out var typeInfo))
            return BadRequest(new { error = $"File type '{contentType}' is not allowed." });

        // Validate size (~7MB base64 ≈ 5MB decoded)
        if (base64Data.Length > typeInfo.MaxSizeMB * 1024 * 1024 * 4 / 3)
            return BadRequest(new { error = $"File too large (max {typeInfo.MaxSizeMB}MB)." });

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64Data);
        }
        catch (FormatException)
        {
            return BadRequest(new { error = "Invalid base64 data." });
        }

        var extension = contentType switch
        {
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            "image/svg+xml" => ".svg",
            _ => ".jpg"
        };

        var fileName = request.FileName ?? $"upload{extension}";
        var userId = GetCurrentUserId();

        // Step 1: Create asset record
        var asset = new Asset
        {
            AssetType = request.AssetType ?? typeInfo.Category,
            FileName = fileName,
            ContentType = contentType,
            FileSize = bytes.Length,
            StorageUrl = string.Empty,
            StorageType = _storageService.StorageType,
            Category = request.Category,
            SiteKey = request.SiteKey,
            UploadedBy = userId,
            IsPublic = request.IsPublic
        };
        asset = await _assetService.CreateAsync(asset);

        // Step 2: Upload
        using var stream = new MemoryStream(bytes);
        var storageUrl = await _storageService.UploadFileAsync(stream, fileName, asset.Id, request.SiteKey);

        // Step 3: Update storage URL
        await _assetService.UpdateStorageUrlAsync(asset.Id, storageUrl);

        return Ok(new AssetUploadResponse
        {
            Success = true,
            AssetId = asset.Id,
            AssetType = asset.AssetType,
            FileName = asset.FileName,
            ContentType = asset.ContentType,
            FileSize = asset.FileSize,
            Url = $"/asset/{asset.Id}"
        });
    }

    /// <summary>
    /// Register an external link as an asset (YouTube, Vimeo, etc.)
    /// </summary>
    [HttpPost("link")]
    [Authorize]
    public async Task<ActionResult<AssetUploadResponse>> RegisterLink([FromBody] RegisterLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { error = "URL is required." });

        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out _))
            return BadRequest(new { error = "Invalid URL format." });

        var (title, thumbnailUrl, detectedContentType) = ExtractLinkInfo(request.Url);
        var userId = GetCurrentUserId();

        var asset = new Asset
        {
            AssetType = request.AssetType ?? AssetTypes.Link,
            FileName = request.Title ?? title ?? "External Link",
            ContentType = detectedContentType,
            FileSize = 0,
            StorageUrl = string.Empty,
            ExternalUrl = request.Url,
            ThumbnailUrl = request.ThumbnailUrl ?? thumbnailUrl,
            StorageType = "external",
            Category = request.Category,
            SiteKey = request.SiteKey,
            UploadedBy = userId,
            IsPublic = request.IsPublic
        };

        asset = await _assetService.CreateAsync(asset);

        return Ok(new AssetUploadResponse
        {
            Success = true,
            AssetId = asset.Id,
            AssetType = asset.AssetType,
            FileName = asset.FileName,
            ContentType = asset.ContentType,
            FileSize = 0,
            Url = $"/asset/{asset.Id}",
            ExternalUrl = asset.ExternalUrl,
            ThumbnailUrl = asset.ThumbnailUrl
        });
    }

    /// <summary>
    /// Serve an asset file by ID. This is THE canonical URL for all assets.
    /// Local → stream file. S3/external → redirect.
    /// </summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAsset(int id)
    {
        var asset = await _assetService.GetByIdAsync(id);
        if (asset == null) return NotFound();

        // Private assets require authentication
        if (!asset.IsPublic && GetCurrentUserId() == null)
            return Unauthorized();

        // External links → redirect
        if (asset.StorageType == "external" && !string.IsNullOrEmpty(asset.ExternalUrl))
            return Redirect(asset.ExternalUrl);

        // S3 with full URL → redirect
        if (asset.StorageType == "s3" && asset.StorageUrl.StartsWith("https://"))
            return Redirect(asset.StorageUrl);

        // Local → stream the file
        var stream = await _storageService.GetFileStreamAsync(asset.StorageUrl);
        if (stream == null) return NotFound();

        return File(stream, asset.ContentType, asset.FileName);
    }

    /// <summary>
    /// Get asset metadata without downloading the file.
    /// </summary>
    [HttpGet("{id:int}/info")]
    [AllowAnonymous]
    public async Task<ActionResult<AssetInfoResponse>> GetAssetInfo(int id)
    {
        var asset = await _assetService.GetByIdAsync(id);
        if (asset == null) return NotFound();

        if (!asset.IsPublic && GetCurrentUserId() == null)
            return Unauthorized();

        return Ok(new AssetInfoResponse
        {
            Id = asset.Id,
            AssetType = asset.AssetType,
            FileName = asset.FileName,
            ContentType = asset.ContentType,
            FileSize = asset.FileSize,
            Category = asset.Category,
            ExternalUrl = asset.ExternalUrl,
            ThumbnailUrl = asset.ThumbnailUrl,
            IsPublic = asset.IsPublic,
            CreatedAt = asset.CreatedAt,
            Url = $"/asset/{asset.Id}"
        });
    }

    /// <summary>
    /// Delete an asset (owner or admin only).
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<ActionResult> DeleteAsset(int id)
    {
        var asset = await _assetService.GetByIdAsync(id);
        if (asset == null) return NotFound();

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("admin");

        if (asset.UploadedBy != userId && !isAdmin)
            return Forbid();

        var deleted = await _assetService.DeleteAsync(id);
        if (!deleted) return StatusCode(500, new { error = "Failed to delete asset." });

        return Ok(new { message = "Asset deleted." });
    }

    // ── Helpers ──

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    private static (string? title, string? thumbnailUrl, string contentType) ExtractLinkInfo(string url)
    {
        var uri = new Uri(url);
        var host = uri.Host.ToLowerInvariant();

        if (host.Contains("youtube.com") || host.Contains("youtu.be"))
        {
            var videoId = ExtractYouTubeVideoId(url);
            if (!string.IsNullOrEmpty(videoId))
                return (null, $"https://img.youtube.com/vi/{videoId}/hqdefault.jpg", "video/youtube");
        }

        if (host.Contains("vimeo.com"))
            return (null, null, "video/vimeo");

        return (null, null, "text/html");
    }

    private static string? ExtractYouTubeVideoId(string url)
    {
        var uri = new Uri(url);
        if (uri.Host.Contains("youtube.com"))
        {
            var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
            return query["v"];
        }
        if (uri.Host.Contains("youtu.be"))
            return uri.AbsolutePath.TrimStart('/');
        return null;
    }
}
