using System.Text.Json;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IGitHubService
{
    Task<List<RepoStatus>> GetReposAsync(List<string> repoFilter);
    Task<DeployInfo?> GetLastDeployAsync(string repoFullName);
    Task<bool> TriggerDeployAsync(string repoFullName);
    Task<List<DeployInfo>> GetDeployHistoryAsync(string repoFullName, int limit = 10);
}

public class GitHubService : IGitHubService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GitHubService> _logger;

    public GitHubService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<GitHubService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("GitHub");
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<List<RepoStatus>> GetReposAsync(List<string> repoFilter)
    {
        var repos = new List<RepoStatus>();
        var org = _configuration["GitHub:Org"] ?? "3E-Tech-Corp";

        try
        {
            var response = await _httpClient.GetAsync($"orgs/{org}/repos?per_page=100&sort=pushed");
            if (!response.IsSuccessStatusCode) return repos;

            var json = await response.Content.ReadAsStringAsync();
            var repoArray = JsonDocument.Parse(json).RootElement;

            foreach (var repo in repoArray.EnumerateArray())
            {
                var name = repo.GetProperty("name").GetString() ?? "";
                var fullName = repo.GetProperty("full_name").GetString() ?? "";

                // Filter: admin sees all ("*"), others see only their repos
                if (!repoFilter.Contains("*") && !repoFilter.Contains(name) && !repoFilter.Contains(fullName))
                    continue;

                var status = new RepoStatus
                {
                    Name = name,
                    FullName = fullName,
                    Private = repo.GetProperty("private").GetBoolean(),
                    DefaultBranch = repo.TryGetProperty("default_branch", out var db) ? db.GetString() : "main",
                    LastPush = repo.TryGetProperty("pushed_at", out var pa) ? pa.GetDateTime() : null
                };

                repos.Add(status);
            }

            // Also check user repos if filter includes them
            if (repoFilter.Contains("*"))
            {
                var userResp = await _httpClient.GetAsync($"users/LegalDragon/repos?per_page=100&sort=pushed");
                if (userResp.IsSuccessStatusCode)
                {
                    var userJson = await userResp.Content.ReadAsStringAsync();
                    var userArray = JsonDocument.Parse(userJson).RootElement;
                    foreach (var repo in userArray.EnumerateArray())
                    {
                        var fullName = repo.GetProperty("full_name").GetString() ?? "";
                        if (repos.Any(r => r.FullName == fullName)) continue;

                        repos.Add(new RepoStatus
                        {
                            Name = repo.GetProperty("name").GetString() ?? "",
                            FullName = fullName,
                            Private = repo.GetProperty("private").GetBoolean(),
                            DefaultBranch = repo.TryGetProperty("default_branch", out var db) ? db.GetString() : "main",
                            LastPush = repo.TryGetProperty("pushed_at", out var pa) ? pa.GetDateTime() : null
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch repos from GitHub");
        }

        return repos.OrderByDescending(r => r.LastPush).ToList();
    }

    public async Task<DeployInfo?> GetLastDeployAsync(string repoFullName)
    {
        try
        {
            var response = await _httpClient.GetAsync(
                $"repos/{repoFullName}/actions/runs?per_page=1&event=workflow_dispatch");
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var runs = doc.RootElement.GetProperty("workflow_runs");

            if (runs.GetArrayLength() == 0) return null;

            var run = runs[0];
            return ParseRunToDeployInfo(run);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get last deploy for {Repo}", repoFullName);
            return null;
        }
    }

    public async Task<List<DeployInfo>> GetDeployHistoryAsync(string repoFullName, int limit = 10)
    {
        var deploys = new List<DeployInfo>();
        try
        {
            var response = await _httpClient.GetAsync(
                $"repos/{repoFullName}/actions/runs?per_page={limit}");
            if (!response.IsSuccessStatusCode) return deploys;

            var json = await response.Content.ReadAsStringAsync();
            var runs = JsonDocument.Parse(json).RootElement.GetProperty("workflow_runs");

            foreach (var run in runs.EnumerateArray())
            {
                deploys.Add(ParseRunToDeployInfo(run));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get deploy history for {Repo}", repoFullName);
        }
        return deploys;
    }

    public async Task<bool> TriggerDeployAsync(string repoFullName)
    {
        try
        {
            // Find the deploy workflow
            var wfResponse = await _httpClient.GetAsync($"repos/{repoFullName}/actions/workflows");
            if (!wfResponse.IsSuccessStatusCode) return false;

            var wfJson = await wfResponse.Content.ReadAsStringAsync();
            var workflows = JsonDocument.Parse(wfJson).RootElement.GetProperty("workflows");

            long? deployWorkflowId = null;
            foreach (var wf in workflows.EnumerateArray())
            {
                var name = wf.GetProperty("name").GetString()?.ToLower() ?? "";
                if (name.Contains("deploy"))
                {
                    deployWorkflowId = wf.GetProperty("id").GetInt64();
                    break;
                }
            }

            if (deployWorkflowId == null) return false;

            // Get default branch
            var repoResp = await _httpClient.GetAsync($"repos/{repoFullName}");
            var repoJson = await repoResp.Content.ReadAsStringAsync();
            var defaultBranch = JsonDocument.Parse(repoJson).RootElement
                .GetProperty("default_branch").GetString() ?? "main";

            // Trigger workflow dispatch
            var content = new StringContent(
                JsonSerializer.Serialize(new { @ref = defaultBranch }),
                System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(
                $"repos/{repoFullName}/actions/workflows/{deployWorkflowId}/dispatches", content);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to trigger deploy for {Repo}", repoFullName);
            return false;
        }
    }

    private static DeployInfo ParseRunToDeployInfo(JsonElement run)
    {
        var startedAt = run.TryGetProperty("created_at", out var ca) ? ca.GetDateTime() : (DateTime?)null;
        var updatedAt = run.TryGetProperty("updated_at", out var ua) ? ua.GetDateTime() : (DateTime?)null;
        int? duration = null;
        if (startedAt.HasValue && updatedAt.HasValue)
        {
            duration = (int)(updatedAt.Value - startedAt.Value).TotalSeconds;
        }

        return new DeployInfo
        {
            RunId = run.GetProperty("id").GetInt64(),
            Status = run.TryGetProperty("conclusion", out var c) && c.ValueKind != JsonValueKind.Null
                ? c.GetString() ?? "in_progress"
                : run.GetProperty("status").GetString() ?? "unknown",
            Commit = run.TryGetProperty("head_sha", out var sha) ? sha.GetString()?[..7] : null,
            CommitMessage = run.TryGetProperty("display_title", out var dt) ? dt.GetString() : null,
            StartedAt = startedAt,
            DurationSeconds = duration
        };
    }
}
