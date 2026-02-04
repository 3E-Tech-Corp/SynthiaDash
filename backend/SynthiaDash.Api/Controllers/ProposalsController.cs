using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class ProposalsController : ControllerBase
{
    private readonly IProposalService _proposalService;
    private readonly ILogger<ProposalsController> _logger;

    public ProposalsController(IProposalService proposalService, ILogger<ProposalsController> logger)
    {
        _proposalService = proposalService;
        _logger = logger;
    }

    private string GetClientIp()
    {
        var forwarded = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
            return forwarded.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst("userId")?.Value;
        if (int.TryParse(userIdClaim, out var userId))
            return userId;
        return null;
    }

    // ── Public endpoints ──

    /// <summary>
    /// List published proposals (public, paginated)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublished([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 50) pageSize = 20;

        var proposals = await _proposalService.GetPublishedProposalsAsync(page, pageSize, search);
        return Ok(proposals);
    }

    /// <summary>
    /// Get a single proposal by share token (public view)
    /// </summary>
    [HttpGet("{shareToken}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByShareToken(string shareToken)
    {
        // Don't match admin routes
        if (shareToken == "admin" || shareToken == "mine" || shareToken == "polish")
            return NotFound();

        var view = await _proposalService.GetPublicViewAsync(shareToken);
        if (view == null) return NotFound();

        // Also return whether the current user/ip has liked it
        var userId = GetUserId();
        var ipHash = userId.HasValue ? null : ProposalService.HashIp(GetClientIp());
        var hasLiked = await _proposalService.HasLikedAsync(view.Id, userId, ipHash);

        return Ok(new { proposal = view, hasLiked });
    }

    /// <summary>
    /// Like/unlike a proposal
    /// </summary>
    [HttpPost("{shareToken}/like")]
    [AllowAnonymous]
    public async Task<IActionResult> Like(string shareToken)
    {
        var proposal = await _proposalService.GetProposalByShareTokenAsync(shareToken);
        if (proposal == null) return NotFound();

        var userId = GetUserId();
        var ipHash = userId.HasValue ? null : ProposalService.HashIp(GetClientIp());

        var liked = await _proposalService.ToggleLikeAsync(proposal.Id, userId, ipHash);

        // Re-fetch to get updated count
        var updated = await _proposalService.GetProposalByIdAsync(proposal.Id);

        return Ok(new { liked, likeCount = updated?.LikeCount ?? 0 });
    }

    /// <summary>
    /// Add a feature suggestion
    /// </summary>
    [HttpPost("{shareToken}/features")]
    [AllowAnonymous]
    public async Task<IActionResult> AddFeature(string shareToken, [FromBody] AddFeatureRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { error = "Description is required" });

        var proposal = await _proposalService.GetProposalByShareTokenAsync(shareToken);
        if (proposal == null) return NotFound();

        var userId = GetUserId();
        var feature = await _proposalService.AddFeatureAsync(proposal.Id, request.Description.Trim(), userId, request.AuthorName);

        return Ok(feature);
    }

    /// <summary>
    /// Submit a value estimate
    /// </summary>
    [HttpPost("{shareToken}/value")]
    [AllowAnonymous]
    public async Task<IActionResult> AddValueEstimate(string shareToken, [FromBody] AddValueEstimateRequest request)
    {
        var proposal = await _proposalService.GetProposalByShareTokenAsync(shareToken);
        if (proposal == null) return NotFound();

        var userId = GetUserId();
        var isAnonymous = !userId.HasValue;
        var weight = isAnonymous ? 0.3m : 1.0m;

        await _proposalService.AddValueEstimateAsync(proposal.Id, userId, isAnonymous, request.WouldPay, request.MonthlyAmount, weight);

        return Ok(new { message = "Value estimate recorded", weight });
    }

    // ── Authenticated endpoints ──

    /// <summary>
    /// Create a new proposal (requires login)
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateProposalRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "Title is required" });
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { error = "Description is required" });

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var proposal = await _proposalService.CreateProposalAsync(request, userId.Value);

        _logger.LogInformation("Proposal #{Id} created by user {UserId}", proposal.Id, userId);

        return Ok(proposal);
    }

    /// <summary>
    /// Polish a description with AI (requires login)
    /// </summary>
    [HttpPost("polish")]
    [Authorize]
    public async Task<IActionResult> Polish([FromBody] PolishDescriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { error = "Description is required" });

        var polished = await _proposalService.PolishDescriptionAsync(request.Description);
        return Ok(new { polished });
    }

    /// <summary>
    /// Update a proposal (set polished description, publish it)
    /// </summary>
    [HttpPatch("{id:int}")]
    [Authorize]
    public async Task<IActionResult> UpdateProposal(int id, [FromBody] UpdateProposalRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var proposal = await _proposalService.GetProposalByIdAsync(id);
        if (proposal == null) return NotFound();
        if (proposal.ProposerId != userId.Value) return Forbid();

        var updated = await _proposalService.UpdateProposalAsync(id, request.PolishedDescription, request.Status);
        return Ok(updated);
    }

    /// <summary>
    /// List my proposals
    /// </summary>
    [HttpGet("mine")]
    [Authorize]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var proposals = await _proposalService.GetMyProposalsAsync(userId.Value);
        return Ok(proposals);
    }

    // ── Admin endpoints ──

    /// <summary>
    /// Admin: list all proposals
    /// </summary>
    [HttpGet("admin")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminList()
    {
        var proposals = await _proposalService.GetAdminListAsync();
        return Ok(proposals);
    }

    /// <summary>
    /// Admin: get full proposal detail
    /// </summary>
    [HttpGet("admin/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminDetail(int id)
    {
        var proposal = await _proposalService.GetAdminDetailAsync(id);
        if (proposal == null) return NotFound();
        return Ok(proposal);
    }

    /// <summary>
    /// Admin: change proposal status
    /// </summary>
    [HttpPost("admin/{id:int}/status")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminUpdateStatus(int id, [FromBody] UpdateProposalStatusRequest request)
    {
        var validStatuses = new[] { "under_review", "accepted", "declined", "published", "draft" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest(new { error = "Invalid status" });

        var success = await _proposalService.UpdateStatusAsync(id, request.Status, request.Reason);
        if (!success) return NotFound();

        return Ok(new { message = "Status updated" });
    }

    /// <summary>
    /// Admin: weekly top proposals
    /// </summary>
    [HttpGet("admin/weekly")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminWeekly()
    {
        var proposals = await _proposalService.GetWeeklyTopAsync();
        return Ok(proposals);
    }
}

public class UpdateProposalRequest
{
    public string? PolishedDescription { get; set; }
    public string? Status { get; set; }
}
