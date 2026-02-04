using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class SoulController : ControllerBase
{
    private readonly ISoulSnapshotService _soulService;
    private readonly ILogger<SoulController> _logger;

    public SoulController(ISoulSnapshotService soulService, ILogger<SoulController> logger)
    {
        _soulService = soulService;
        _logger = logger;
    }

    /// <summary>
    /// Public: list published soul snapshots (no content, newest first)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublished()
    {
        var snapshots = await _soulService.GetPublishedAsync();
        return Ok(snapshots);
    }

    /// <summary>
    /// Admin: list ALL soul snapshots including unpublished
    /// </summary>
    [HttpGet("admin")]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        if (!User.IsInRole("admin")) return Forbid();
        var snapshots = await _soulService.GetAllAsync();
        return Ok(snapshots);
    }

    /// <summary>
    /// Public: get a published snapshot with full content
    /// </summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        // If admin, show any snapshot. If public, only published.
        var isAdmin = User.Identity?.IsAuthenticated == true && User.IsInRole("admin");
        var snapshot = await _soulService.GetByIdAsync(id, publishedOnly: !isAdmin);
        if (snapshot == null) return NotFound();
        return Ok(snapshot);
    }

    /// <summary>
    /// Public: get the latest published snapshot with full content
    /// </summary>
    [HttpGet("latest")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLatest()
    {
        var snapshot = await _soulService.GetLatestAsync();
        if (snapshot == null) return NotFound();
        return Ok(snapshot);
    }

    /// <summary>
    /// Admin: create a new soul snapshot (unpublished by default)
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateSoulSnapshotRequest request)
    {
        if (!User.IsInRole("admin")) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "Title and Content are required" });

        var snapshot = new SoulSnapshot
        {
            Date = request.Date ?? DateTime.UtcNow.Date,
            Title = request.Title,
            Summary = request.Summary ?? string.Empty,
            Content = request.Content,
            IsPublished = request.IsPublished ?? false
        };

        var created = await _soulService.CreateAsync(snapshot);
        _logger.LogInformation("Soul snapshot created: {Title} ({Date}), published={Published}", created.Title, created.Date, created.IsPublished);
        return Ok(created);
    }

    /// <summary>
    /// Admin: update a soul snapshot
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSoulSnapshotRequest request)
    {
        if (!User.IsInRole("admin")) return Forbid();

        var snapshot = new SoulSnapshot
        {
            Date = request.Date ?? DateTime.UtcNow.Date,
            Title = request.Title ?? string.Empty,
            Summary = request.Summary ?? string.Empty,
            Content = request.Content ?? string.Empty,
            IsPublished = request.IsPublished ?? false
        };

        var updated = await _soulService.UpdateAsync(id, snapshot);
        if (!updated) return NotFound();
        return Ok(new { message = "Updated" });
    }

    /// <summary>
    /// Admin: toggle publish/unpublish a snapshot
    /// </summary>
    [HttpPost("{id:int}/publish")]
    [Authorize]
    public async Task<IActionResult> TogglePublish(int id, [FromBody] TogglePublishRequest request)
    {
        if (!User.IsInRole("admin")) return Forbid();
        var updated = await _soulService.TogglePublishAsync(id, request.IsPublished);
        if (!updated) return NotFound();
        _logger.LogInformation("Soul snapshot {Id} publish toggled to {Published}", id, request.IsPublished);
        return Ok(new { message = request.IsPublished ? "Published" : "Unpublished" });
    }

    /// <summary>
    /// Admin: delete a soul snapshot
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        if (!User.IsInRole("admin")) return Forbid();
        var deleted = await _soulService.DeleteAsync(id);
        if (!deleted) return NotFound();
        return Ok(new { message = "Deleted" });
    }
}

public class CreateSoulSnapshotRequest
{
    public DateTime? Date { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool? IsPublished { get; set; }
}

public class TogglePublishRequest
{
    public bool IsPublished { get; set; }
}
