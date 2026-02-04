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
    /// Public: list all soul snapshots (without content, ordered newest first)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var snapshots = await _soulService.GetAllAsync();
        return Ok(snapshots);
    }

    /// <summary>
    /// Public: get a single snapshot with full content
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var snapshot = await _soulService.GetByIdAsync(id);
        if (snapshot == null) return NotFound();
        return Ok(snapshot);
    }

    /// <summary>
    /// Public: get the latest snapshot with full content
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
    /// Admin: create a new soul snapshot
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
            Content = request.Content
        };

        var created = await _soulService.CreateAsync(snapshot);
        _logger.LogInformation("Soul snapshot created: {Title} ({Date})", created.Title, created.Date);
        return Ok(created);
    }

    /// <summary>
    /// Admin: update a soul snapshot
    /// </summary>
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSoulSnapshotRequest request)
    {
        if (!User.IsInRole("admin")) return Forbid();

        var snapshot = new SoulSnapshot
        {
            Date = request.Date ?? DateTime.UtcNow.Date,
            Title = request.Title ?? string.Empty,
            Summary = request.Summary ?? string.Empty,
            Content = request.Content ?? string.Empty
        };

        var updated = await _soulService.UpdateAsync(id, snapshot);
        if (!updated) return NotFound();
        return Ok(new { message = "Updated" });
    }

    /// <summary>
    /// Admin: delete a soul snapshot
    /// </summary>
    [HttpDelete("{id}")]
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
}
