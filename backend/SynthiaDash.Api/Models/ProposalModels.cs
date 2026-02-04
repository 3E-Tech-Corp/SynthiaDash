namespace SynthiaDash.Api.Models;

// ── Database records ──

public class ProjectProposal
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string RawDescription { get; set; } = string.Empty;
    public string? PolishedDescription { get; set; }
    public string? Problem { get; set; }
    public string? ProposerRole { get; set; }
    public int? ExpectedUsers { get; set; }
    public decimal? ExpectedMonthlyValue { get; set; }
    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";
    public string? DeclineReason { get; set; }
    public int? ProposerId { get; set; }
    public int LikeCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ProposalFeature
{
    public int Id { get; set; }
    public int ProposalId { get; set; }
    public string Description { get; set; } = string.Empty;
    public int? AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProposalLike
{
    public int Id { get; set; }
    public int ProposalId { get; set; }
    public int? UserId { get; set; }
    public bool IsAnonymous { get; set; }
    public string? IpHash { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProposalValueEstimate
{
    public int Id { get; set; }
    public int ProposalId { get; set; }
    public int? UserId { get; set; }
    public bool IsAnonymous { get; set; }
    public bool WouldPay { get; set; }
    public decimal? MonthlyAmount { get; set; }
    public decimal Weight { get; set; } = 1.0m;
    public DateTime CreatedAt { get; set; }
}

// ── Request DTOs ──

public class CreateProposalRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Problem { get; set; }
    public string? ProposerRole { get; set; }
    public int? ExpectedUsers { get; set; }
    public decimal? ExpectedMonthlyValue { get; set; }
}

public class AddFeatureRequest
{
    public string Description { get; set; } = string.Empty;
    public string? AuthorName { get; set; }
}

public class AddValueEstimateRequest
{
    public bool WouldPay { get; set; }
    public decimal? MonthlyAmount { get; set; }
}

public class UpdateProposalStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class PolishDescriptionRequest
{
    public string Description { get; set; } = string.Empty;
}

// ── Response DTOs ──

public class ProposalListItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? PolishedDescription { get; set; }
    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int LikeCount { get; set; }
    public int FeatureCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProposalPublicView
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? PolishedDescription { get; set; }
    public string? Problem { get; set; }
    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int LikeCount { get; set; }
    public List<ProposalFeature> Features { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class ProposalAdminView
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string RawDescription { get; set; } = string.Empty;
    public string? PolishedDescription { get; set; }
    public string? Problem { get; set; }
    public string? ProposerRole { get; set; }
    public int? ExpectedUsers { get; set; }
    public decimal? ExpectedMonthlyValue { get; set; }
    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? DeclineReason { get; set; }
    public int? ProposerId { get; set; }
    public string? ProposerEmail { get; set; }
    public int LikeCount { get; set; }
    public int FeatureCount { get; set; }
    public int SupporterCount { get; set; }
    public decimal WeightedValueScore { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<ProposalFeature> Features { get; set; } = new();
    public List<ProposalValueEstimate> ValueEstimates { get; set; } = new();
}

public class PublicRegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
}
