using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IProposalService
{
    Task<ProjectProposal> CreateProposalAsync(CreateProposalRequest request, int proposerId);
    Task<ProjectProposal?> GetProposalByShareTokenAsync(string shareToken);
    Task<ProjectProposal?> GetProposalByIdAsync(int id);
    Task<List<ProposalListItem>> GetPublishedProposalsAsync(int page, int pageSize, string? search);
    Task<List<ProposalListItem>> GetMyProposalsAsync(int userId);
    Task<ProposalPublicView?> GetPublicViewAsync(string shareToken);
    Task<List<ProposalFeature>> GetFeaturesAsync(int proposalId);
    Task<ProposalFeature> AddFeatureAsync(int proposalId, string description, int? authorId, string? authorName);
    Task<bool> ToggleLikeAsync(int proposalId, int? userId, string? ipHash);
    Task<bool> HasLikedAsync(int proposalId, int? userId, string? ipHash);
    Task AddValueEstimateAsync(int proposalId, int? userId, bool isAnonymous, bool wouldPay, decimal? monthlyAmount, decimal weight);
    Task<List<ProposalAdminView>> GetAdminListAsync();
    Task<ProposalAdminView?> GetAdminDetailAsync(int id);
    Task<bool> UpdateStatusAsync(int id, string status, string? reason);
    Task<List<ProposalAdminView>> GetWeeklyTopAsync();
    Task<ProjectProposal> UpdateProposalAsync(int id, string? polishedDescription, string? status);
    Task<string> PolishDescriptionAsync(string rawDescription);
}

public class ProposalService : IProposalService
{
    private readonly string _connectionString;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ProposalService> _logger;
    private static readonly char[] AlphaNum = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray();

    public ProposalService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<ProposalService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection is required");
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    private static string GenerateShareToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(12);
        var sb = new StringBuilder(12);
        foreach (var b in bytes)
            sb.Append(AlphaNum[b % AlphaNum.Length]);
        return sb.ToString();
    }

    public static string HashIp(string ip)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(ip + "_synthia_salt"));
        return Convert.ToHexString(hash)[..16].ToLower();
    }

    public async Task<ProjectProposal> CreateProposalAsync(CreateProposalRequest request, int proposerId)
    {
        using var db = new SqlConnection(_connectionString);

        var shareToken = GenerateShareToken();

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO ProjectProposals (Title, RawDescription, Problem, ProposerRole, ExpectedUsers, ExpectedMonthlyValue, ShareToken, ProposerId)
              OUTPUT INSERTED.Id
              VALUES (@Title, @Description, @Problem, @ProposerRole, @ExpectedUsers, @ExpectedMonthlyValue, @ShareToken, @ProposerId)",
            new
            {
                request.Title,
                request.Description,
                request.Problem,
                request.ProposerRole,
                request.ExpectedUsers,
                request.ExpectedMonthlyValue,
                ShareToken = shareToken,
                ProposerId = proposerId
            });

        return (await GetProposalByIdAsync(id))!;
    }

    public async Task<ProjectProposal?> GetProposalByShareTokenAsync(string shareToken)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<ProjectProposal>(
            "SELECT * FROM ProjectProposals WHERE ShareToken = @ShareToken",
            new { ShareToken = shareToken });
    }

    public async Task<ProjectProposal?> GetProposalByIdAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<ProjectProposal>(
            "SELECT * FROM ProjectProposals WHERE Id = @Id",
            new { Id = id });
    }

    public async Task<List<ProposalListItem>> GetPublishedProposalsAsync(int page, int pageSize, string? search)
    {
        using var db = new SqlConnection(_connectionString);

        var sql = @"SELECT p.Id, p.Title, p.PolishedDescription, p.ShareToken, p.Status, p.LikeCount, p.CreatedAt,
                           (SELECT COUNT(*) FROM ProposalFeatures f WHERE f.ProposalId = p.Id) AS FeatureCount
                    FROM ProjectProposals p
                    WHERE p.Status = 'published'";

        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (p.Title LIKE @Search OR p.PolishedDescription LIKE @Search OR p.RawDescription LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        sql += " ORDER BY p.LikeCount DESC, p.CreatedAt DESC";
        sql += " OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        parameters.Add("Offset", (page - 1) * pageSize);
        parameters.Add("PageSize", pageSize);

        var results = await db.QueryAsync<ProposalListItem>(sql, parameters);
        return results.ToList();
    }

    public async Task<List<ProposalListItem>> GetMyProposalsAsync(int userId)
    {
        using var db = new SqlConnection(_connectionString);

        var results = await db.QueryAsync<ProposalListItem>(
            @"SELECT p.Id, p.Title, p.PolishedDescription, p.ShareToken, p.Status, p.LikeCount, p.CreatedAt,
                     (SELECT COUNT(*) FROM ProposalFeatures f WHERE f.ProposalId = p.Id) AS FeatureCount
              FROM ProjectProposals p
              WHERE p.ProposerId = @UserId
              ORDER BY p.CreatedAt DESC",
            new { UserId = userId });

        return results.ToList();
    }

    public async Task<ProposalPublicView?> GetPublicViewAsync(string shareToken)
    {
        using var db = new SqlConnection(_connectionString);

        var proposal = await db.QueryFirstOrDefaultAsync<ProjectProposal>(
            "SELECT * FROM ProjectProposals WHERE ShareToken = @ShareToken",
            new { ShareToken = shareToken });

        if (proposal == null) return null;

        var features = await db.QueryAsync<ProposalFeature>(
            "SELECT * FROM ProposalFeatures WHERE ProposalId = @ProposalId ORDER BY CreatedAt ASC",
            new { ProposalId = proposal.Id });

        return new ProposalPublicView
        {
            Id = proposal.Id,
            Title = proposal.Title,
            PolishedDescription = proposal.PolishedDescription ?? proposal.RawDescription,
            Problem = proposal.Problem,
            ShareToken = proposal.ShareToken,
            Status = proposal.Status,
            LikeCount = proposal.LikeCount,
            Features = features.ToList(),
            CreatedAt = proposal.CreatedAt
        };
    }

    public async Task<List<ProposalFeature>> GetFeaturesAsync(int proposalId)
    {
        using var db = new SqlConnection(_connectionString);
        var results = await db.QueryAsync<ProposalFeature>(
            "SELECT * FROM ProposalFeatures WHERE ProposalId = @ProposalId ORDER BY CreatedAt ASC",
            new { ProposalId = proposalId });
        return results.ToList();
    }

    public async Task<ProposalFeature> AddFeatureAsync(int proposalId, string description, int? authorId, string? authorName)
    {
        using var db = new SqlConnection(_connectionString);

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO ProposalFeatures (ProposalId, Description, AuthorId, AuthorName)
              OUTPUT INSERTED.Id
              VALUES (@ProposalId, @Description, @AuthorId, @AuthorName)",
            new { ProposalId = proposalId, Description = description, AuthorId = authorId, AuthorName = authorName });

        return (await db.QueryFirstAsync<ProposalFeature>(
            "SELECT * FROM ProposalFeatures WHERE Id = @Id", new { Id = id }));
    }

    public async Task<bool> ToggleLikeAsync(int proposalId, int? userId, string? ipHash)
    {
        using var db = new SqlConnection(_connectionString);

        // Check if already liked
        bool alreadyLiked = await HasLikedAsync(proposalId, userId, ipHash, db);

        if (alreadyLiked)
        {
            // Unlike
            if (userId.HasValue)
            {
                await db.ExecuteAsync(
                    "DELETE FROM ProposalLikes WHERE ProposalId = @ProposalId AND UserId = @UserId",
                    new { ProposalId = proposalId, UserId = userId });
            }
            else
            {
                await db.ExecuteAsync(
                    "DELETE FROM ProposalLikes WHERE ProposalId = @ProposalId AND IpHash = @IpHash AND UserId IS NULL",
                    new { ProposalId = proposalId, IpHash = ipHash });
            }

            await db.ExecuteAsync(
                "UPDATE ProjectProposals SET LikeCount = (SELECT COUNT(*) FROM ProposalLikes WHERE ProposalId = @Id) WHERE Id = @Id",
                new { Id = proposalId });

            return false; // unliked
        }
        else
        {
            // Like
            await db.ExecuteAsync(
                @"INSERT INTO ProposalLikes (ProposalId, UserId, IsAnonymous, IpHash)
                  VALUES (@ProposalId, @UserId, @IsAnonymous, @IpHash)",
                new
                {
                    ProposalId = proposalId,
                    UserId = userId,
                    IsAnonymous = !userId.HasValue,
                    IpHash = ipHash
                });

            await db.ExecuteAsync(
                "UPDATE ProjectProposals SET LikeCount = (SELECT COUNT(*) FROM ProposalLikes WHERE ProposalId = @Id) WHERE Id = @Id",
                new { Id = proposalId });

            return true; // liked
        }
    }

    public async Task<bool> HasLikedAsync(int proposalId, int? userId, string? ipHash)
    {
        using var db = new SqlConnection(_connectionString);
        return await HasLikedAsync(proposalId, userId, ipHash, db);
    }

    private async Task<bool> HasLikedAsync(int proposalId, int? userId, string? ipHash, SqlConnection db)
    {
        if (userId.HasValue)
        {
            return await db.QueryFirstOrDefaultAsync<int?>(
                "SELECT Id FROM ProposalLikes WHERE ProposalId = @ProposalId AND UserId = @UserId",
                new { ProposalId = proposalId, UserId = userId }) != null;
        }
        else if (!string.IsNullOrEmpty(ipHash))
        {
            return await db.QueryFirstOrDefaultAsync<int?>(
                "SELECT Id FROM ProposalLikes WHERE ProposalId = @ProposalId AND IpHash = @IpHash AND UserId IS NULL",
                new { ProposalId = proposalId, IpHash = ipHash }) != null;
        }
        return false;
    }

    public async Task AddValueEstimateAsync(int proposalId, int? userId, bool isAnonymous, bool wouldPay, decimal? monthlyAmount, decimal weight)
    {
        using var db = new SqlConnection(_connectionString);

        await db.ExecuteAsync(
            @"INSERT INTO ProposalValueEstimates (ProposalId, UserId, IsAnonymous, WouldPay, MonthlyAmount, Weight)
              VALUES (@ProposalId, @UserId, @IsAnonymous, @WouldPay, @MonthlyAmount, @Weight)",
            new
            {
                ProposalId = proposalId,
                UserId = userId,
                IsAnonymous = isAnonymous,
                WouldPay = wouldPay,
                MonthlyAmount = monthlyAmount,
                Weight = weight
            });
    }

    public async Task<List<ProposalAdminView>> GetAdminListAsync()
    {
        using var db = new SqlConnection(_connectionString);

        var proposals = await db.QueryAsync<ProposalAdminView>(
            @"SELECT p.Id, p.Title, p.RawDescription, p.PolishedDescription, p.Problem, p.ProposerRole,
                     p.ExpectedUsers, p.ExpectedMonthlyValue, p.ShareToken, p.Status, p.DeclineReason,
                     p.ProposerId, u.Email AS ProposerEmail, p.LikeCount, p.CreatedAt, p.UpdatedAt,
                     (SELECT COUNT(*) FROM ProposalFeatures f WHERE f.ProposalId = p.Id) AS FeatureCount,
                     (SELECT COUNT(DISTINCT COALESCE(CAST(ve.UserId AS NVARCHAR), 'anon')) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id) AS SupporterCount,
                     ISNULL((SELECT SUM(ve.MonthlyAmount * ve.Weight) / NULLIF(COUNT(*), 0) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id AND ve.WouldPay = 1), 0) AS WeightedValueScore
              FROM ProjectProposals p
              LEFT JOIN Users u ON p.ProposerId = u.Id
              ORDER BY p.CreatedAt DESC");

        return proposals.ToList();
    }

    public async Task<ProposalAdminView?> GetAdminDetailAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);

        var proposal = await db.QueryFirstOrDefaultAsync<ProposalAdminView>(
            @"SELECT p.Id, p.Title, p.RawDescription, p.PolishedDescription, p.Problem, p.ProposerRole,
                     p.ExpectedUsers, p.ExpectedMonthlyValue, p.ShareToken, p.Status, p.DeclineReason,
                     p.ProposerId, u.Email AS ProposerEmail, p.LikeCount, p.CreatedAt, p.UpdatedAt,
                     (SELECT COUNT(*) FROM ProposalFeatures f WHERE f.ProposalId = p.Id) AS FeatureCount,
                     (SELECT COUNT(DISTINCT COALESCE(CAST(ve.UserId AS NVARCHAR), 'anon')) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id) AS SupporterCount,
                     ISNULL((SELECT SUM(ve.MonthlyAmount * ve.Weight) / NULLIF(COUNT(*), 0) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id AND ve.WouldPay = 1), 0) AS WeightedValueScore
              FROM ProjectProposals p
              LEFT JOIN Users u ON p.ProposerId = u.Id
              WHERE p.Id = @Id",
            new { Id = id });

        if (proposal == null) return null;

        proposal.Features = (await db.QueryAsync<ProposalFeature>(
            "SELECT * FROM ProposalFeatures WHERE ProposalId = @ProposalId ORDER BY CreatedAt ASC",
            new { ProposalId = id })).ToList();

        proposal.ValueEstimates = (await db.QueryAsync<ProposalValueEstimate>(
            "SELECT * FROM ProposalValueEstimates WHERE ProposalId = @ProposalId ORDER BY CreatedAt ASC",
            new { ProposalId = id })).ToList();

        return proposal;
    }

    public async Task<bool> UpdateStatusAsync(int id, string status, string? reason)
    {
        using var db = new SqlConnection(_connectionString);

        var sql = "UPDATE ProjectProposals SET Status = @Status, UpdatedAt = GETUTCDATE()";
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);
        parameters.Add("Status", status);

        if (status == "declined" && !string.IsNullOrEmpty(reason))
        {
            sql += ", DeclineReason = @Reason";
            parameters.Add("Reason", reason);
        }

        sql += " WHERE Id = @Id";

        var affected = await db.ExecuteAsync(sql, parameters);
        return affected > 0;
    }

    public async Task<List<ProposalAdminView>> GetWeeklyTopAsync()
    {
        using var db = new SqlConnection(_connectionString);

        var proposals = await db.QueryAsync<ProposalAdminView>(
            @"SELECT p.Id, p.Title, p.RawDescription, p.PolishedDescription, p.Problem, p.ProposerRole,
                     p.ExpectedUsers, p.ExpectedMonthlyValue, p.ShareToken, p.Status, p.DeclineReason,
                     p.ProposerId, u.Email AS ProposerEmail, p.LikeCount, p.CreatedAt, p.UpdatedAt,
                     (SELECT COUNT(*) FROM ProposalFeatures f WHERE f.ProposalId = p.Id) AS FeatureCount,
                     (SELECT COUNT(DISTINCT COALESCE(CAST(ve.UserId AS NVARCHAR), 'anon')) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id) AS SupporterCount,
                     ISNULL((SELECT SUM(ve.MonthlyAmount * ve.Weight) / NULLIF(COUNT(*), 0) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id AND ve.WouldPay = 1), 0) AS WeightedValueScore
              FROM ProjectProposals p
              LEFT JOIN Users u ON p.ProposerId = u.Id
              WHERE p.CreatedAt >= DATEADD(day, -7, GETUTCDATE())
              ORDER BY
                ISNULL((SELECT SUM(ve.MonthlyAmount * ve.Weight) / NULLIF(COUNT(*), 0) FROM ProposalValueEstimates ve WHERE ve.ProposalId = p.Id AND ve.WouldPay = 1), 0) DESC,
                p.LikeCount DESC");

        return proposals.ToList();
    }

    public async Task<ProjectProposal> UpdateProposalAsync(int id, string? polishedDescription, string? status)
    {
        using var db = new SqlConnection(_connectionString);

        var updates = new List<string> { "UpdatedAt = GETUTCDATE()" };
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (polishedDescription != null)
        {
            updates.Add("PolishedDescription = @PolishedDescription");
            parameters.Add("PolishedDescription", polishedDescription);
        }

        if (status != null)
        {
            updates.Add("Status = @Status");
            parameters.Add("Status", status);
        }

        var sql = $"UPDATE ProjectProposals SET {string.Join(", ", updates)} WHERE Id = @Id";
        await db.ExecuteAsync(sql, parameters);

        return (await GetProposalByIdAsync(id))!;
    }

    public async Task<string> PolishDescriptionAsync(string rawDescription)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("Gateway");

            var payload = new
            {
                model = "clawdbot",
                stream = false,
                messages = new[]
                {
                    new
                    {
                        role = "system",
                        content = "You are a product manager. Take this rough project idea and rewrite it as a clear, professional project proposal. Keep the original intent but make it polished and compelling. Be concise — 2-3 paragraphs max. Return ONLY the polished description text, no headers or labels."
                    },
                    new
                    {
                        role = "user",
                        content = rawDescription
                    }
                }
            };

            var jsonContent = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8, "application/json");

            var response = await client.PostAsync("/v1/chat/completions", jsonContent);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gateway polish failed: {Status}", response.StatusCode);
                return rawDescription;
            }

            var body = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(body);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return content ?? rawDescription;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI polish failed, using raw description");
            return rawDescription;
        }
    }
}
