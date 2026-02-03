using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class FeaturedProjectsController : ControllerBase
{
    private readonly IFeaturedProjectService _featuredProjectService;
    private readonly ILogger<FeaturedProjectsController> _logger;

    public FeaturedProjectsController(
        IFeaturedProjectService featuredProjectService,
        ILogger<FeaturedProjectsController> logger)
    {
        _featuredProjectService = featuredProjectService;
        _logger = logger;
    }

    /// <summary>
    /// Public: get active featured projects ordered by SortOrder
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetFeaturedProjects()
    {
        var projects = await _featuredProjectService.GetAllAsync(isActive: true);
        return Ok(projects);
    }

    /// <summary>
    /// Admin: get ALL featured projects (including inactive)
    /// </summary>
    [HttpGet("admin")]
    public async Task<IActionResult> GetFeaturedProjectsAdmin()
    {
        if (!IsAdmin()) return Forbid();
        var projects = await _featuredProjectService.GetAllAsync();
        return Ok(projects);
    }

    /// <summary>
    /// Admin: create a new featured project
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateFeaturedProject([FromBody] CreateFeaturedProjectRequest request)
    {
        if (!IsAdmin()) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "Title is required" });
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { error = "URL is required" });

        var project = await _featuredProjectService.CreateAsync(request);
        _logger.LogInformation("Admin created featured project: {Title}", request.Title);
        return Ok(project);
    }

    /// <summary>
    /// Admin: update a featured project
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateFeaturedProject(int id, [FromBody] UpdateFeaturedProjectRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var project = await _featuredProjectService.UpdateAsync(id, request);
        if (project == null) return NotFound();

        return Ok(project);
    }

    /// <summary>
    /// Admin: delete a featured project
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteFeaturedProject(int id)
    {
        if (!IsAdmin()) return Forbid();

        var deleted = await _featuredProjectService.DeleteAsync(id);
        if (!deleted) return NotFound();

        return Ok(new { message = "Featured project deleted" });
    }

    /// <summary>
    /// Admin: upload thumbnail image for a featured project.
    /// Accepts base64-encoded image in JSON body to avoid Cloudflare WAF blocking multipart uploads.
    /// </summary>
    [HttpPost("{id}/thumbnail")]
    public async Task<IActionResult> UploadThumbnail(int id, [FromBody] ThumbnailUploadRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var existing = await _featuredProjectService.GetByIdAsync(id);
        if (existing == null) return NotFound();

        if (string.IsNullOrEmpty(request?.ImageData))
            return BadRequest(new { error = "No image data provided" });

        try
        {
            // Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
            string base64Data;
            string contentType = "image/jpeg";
            string extension = ".jpg";

            if (request.ImageData.StartsWith("data:"))
            {
                var commaIdx = request.ImageData.IndexOf(',');
                if (commaIdx < 0)
                    return BadRequest(new { error = "Invalid image data format" });

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

            // Validate size (~5MB after base64 decode)
            if (base64Data.Length > 7_000_000)
                return BadRequest(new { error = "Image too large (max 5MB)" });

            extension = contentType switch
            {
                "image/png" => ".png",
                "image/gif" => ".gif",
                "image/webp" => ".webp",
                _ => ".jpg"
            };

            var bytes = Convert.FromBase64String(base64Data);
            using var stream = new MemoryStream(bytes);

            var path = await _featuredProjectService.SaveThumbnailAsync(
                id, stream, $"thumbnail{extension}", contentType);

            return Ok(new { thumbnailPath = path });
        }
        catch (FormatException)
        {
            return BadRequest(new { error = "Invalid base64 image data" });
        }
    }

    /// <summary>
    /// Admin: reorder featured projects
    /// </summary>
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder([FromBody] List<ReorderItem> items)
    {
        if (!IsAdmin()) return Forbid();

        if (items == null || items.Count == 0)
            return BadRequest(new { error = "Items array is required" });

        await _featuredProjectService.ReorderAsync(items);
        return Ok(new { message = "Reorder successful" });
    }

    private bool IsAdmin()
    {
        return User.IsInRole("admin");
    }
}

public class ThumbnailUploadRequest
{
    public string ImageData { get; set; } = string.Empty;
}
