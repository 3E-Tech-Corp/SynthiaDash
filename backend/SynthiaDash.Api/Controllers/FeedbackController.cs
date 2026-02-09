using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly IFeedbackService _feedbackService;
    private readonly ILogger<FeedbackController> _logger;

    public FeedbackController(IFeedbackService feedbackService, ILogger<FeedbackController> logger)
    {
        _feedbackService = feedbackService;
        _logger = logger;
    }

    /// <summary>
    /// Submit feedback for the Good AI initiative (public endpoint)
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Submit([FromBody] FeedbackCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { error = "Message is required" });

        if (dto.Message.Length > 2000)
            return BadRequest(new { error = "Message must be 2000 characters or less" });

        try
        {
            var feedback = await _feedbackService.CreateAsync(dto);
            return Ok(new { 
                success = true, 
                message = "Thank you for your feedback! It's now live.",
                id = feedback.Id 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting feedback");
            return StatusCode(500, new { error = "Failed to submit feedback" });
        }
    }

    /// <summary>
    /// Get approved public feedback (public endpoint)
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublic([FromQuery] int limit = 20)
    {
        try
        {
            var feedback = await _feedbackService.GetApprovedPublicAsync(Math.Min(limit, 50));
            return Ok(feedback);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching public feedback");
            return StatusCode(500, new { error = "Failed to fetch feedback" });
        }
    }

    /// <summary>
    /// Get all feedback (admin only)
    /// </summary>
    [HttpGet("all")]
    [Authorize(Roles = "admin,moderator")]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var feedback = await _feedbackService.GetAllAsync();
            return Ok(feedback);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all feedback");
            return StatusCode(500, new { error = "Failed to fetch feedback" });
        }
    }

    /// <summary>
    /// Approve feedback for public display (admin only)
    /// </summary>
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "admin,moderator")]
    public async Task<IActionResult> Approve(int id)
    {
        try
        {
            var success = await _feedbackService.ApproveAsync(id);
            if (!success)
                return NotFound(new { error = "Feedback not found" });
            
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving feedback {Id}", id);
            return StatusCode(500, new { error = "Failed to approve feedback" });
        }
    }

    /// <summary>
    /// Revoke/hide feedback from public display (admin only)
    /// </summary>
    [HttpPost("{id}/revoke")]
    [Authorize(Roles = "admin,moderator")]
    public async Task<IActionResult> Revoke(int id)
    {
        try
        {
            var success = await _feedbackService.RevokeAsync(id);
            if (!success)
                return NotFound(new { error = "Feedback not found" });
            
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking feedback {Id}", id);
            return StatusCode(500, new { error = "Failed to revoke feedback" });
        }
    }

    /// <summary>
    /// Delete feedback (admin only)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "admin,moderator")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var success = await _feedbackService.DeleteAsync(id);
            if (!success)
                return NotFound(new { error = "Feedback not found" });
            
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting feedback {Id}", id);
            return StatusCode(500, new { error = "Failed to delete feedback" });
        }
    }
}
