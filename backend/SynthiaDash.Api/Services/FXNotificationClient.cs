using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SynthiaDash.Api.Services;

/// <summary>
/// Client for FXNotification centralized notification service.
/// Designed to be copy-pasteable to other projects — only depends on IHttpClientFactory + IConfiguration.
/// 
/// Configuration (appsettings.json):
///   "FXNotification": {
///     "BaseUrl": "https://pie.funtimepb.com:5100",
///     "ApiKey": "fxn_..."
///   }
/// 
/// Registration (Program.cs):
///   builder.Services.AddHttpClient("FXNotification", client => { ... });
///   builder.Services.AddSingleton&lt;IFXNotificationClient, FXNotificationClient&gt;();
/// </summary>
public interface IFXNotificationClient
{
    /// <summary>Get all available notification tasks from FXNotification.</summary>
    Task<List<FXNotificationTask>> GetTasksAsync();

    /// <summary>Queue a notification for delivery.</summary>
    Task<FXQueueResult> QueueAsync(
        string taskCode,
        string to,
        object? bodyJson = null,
        string? bodyHtml = null,
        string? detailJson = null,
        string? objectId = null);

    /// <summary>Get delivery status of a queued notification.</summary>
    Task<FXNotificationStatus?> GetStatusAsync(int id);

    /// <summary>Check if the FXNotification service is reachable.</summary>
    Task<FXHealthResult> HealthCheckAsync();
}

public class FXNotificationClient : IFXNotificationClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _baseUrl;
    private readonly string _apiKey;
    private readonly ILogger<FXNotificationClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public FXNotificationClient(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<FXNotificationClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _baseUrl = configuration["FXNotification:BaseUrl"]?.TrimEnd('/') ?? "";
        _apiKey = configuration["FXNotification:ApiKey"] ?? "";
        _logger = logger;
    }

    public async Task<List<FXNotificationTask>> GetTasksAsync()
    {
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{_baseUrl}/api/tasks");
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<FXNotificationTask>>(json, JsonOptions)
                ?? new List<FXNotificationTask>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get tasks from FXNotification");
            return new List<FXNotificationTask>();
        }
    }

    public async Task<FXQueueResult> QueueAsync(
        string taskCode,
        string to,
        object? bodyJson = null,
        string? bodyHtml = null,
        string? detailJson = null,
        string? objectId = null)
    {
        try
        {
            var client = CreateClient();

            var payload = new Dictionary<string, object?>
            {
                ["taskCode"] = taskCode,
                ["to"] = to
            };

            if (bodyJson != null)
                payload["bodyJson"] = bodyJson is string s ? s : JsonSerializer.Serialize(bodyJson, JsonOptions);
            if (bodyHtml != null)
                payload["bodyHtml"] = bodyHtml;
            if (detailJson != null)
                payload["detailJson"] = detailJson;
            if (objectId != null)
                payload["objectId"] = objectId;

            var content = new StringContent(
                JsonSerializer.Serialize(payload, JsonOptions),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync($"{_baseUrl}/api/notifications/queue", content);

            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("FXNotification queue failed: {Status} {Body}", response.StatusCode, responseBody);
                return new FXQueueResult { Success = false, Error = responseBody };
            }

            var result = JsonSerializer.Deserialize<FXQueueResult>(responseBody, JsonOptions)
                ?? new FXQueueResult { Success = true };
            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to queue notification via FXNotification");
            return new FXQueueResult { Success = false, Error = ex.Message };
        }
    }

    public async Task<FXNotificationStatus?> GetStatusAsync(int id)
    {
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{_baseUrl}/api/notifications/{id}/status");

            if (!response.IsSuccessStatusCode)
                return null;

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<FXNotificationStatus>(json, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get notification status from FXNotification for id {Id}", id);
            return null;
        }
    }

    public async Task<FXHealthResult> HealthCheckAsync()
    {
        if (string.IsNullOrEmpty(_baseUrl))
            return new FXHealthResult { IsHealthy = false, Error = "BaseUrl not configured" };

        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{_baseUrl}/api/tasks");
            return new FXHealthResult
            {
                IsHealthy = response.IsSuccessStatusCode,
                BaseUrl = _baseUrl,
                HasApiKey = !string.IsNullOrEmpty(_apiKey),
                Error = response.IsSuccessStatusCode ? null : $"HTTP {(int)response.StatusCode}"
            };
        }
        catch (Exception ex)
        {
            return new FXHealthResult
            {
                IsHealthy = false,
                BaseUrl = _baseUrl,
                HasApiKey = !string.IsNullOrEmpty(_apiKey),
                Error = ex.Message
            };
        }
    }

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient("FXNotification");
        if (!string.IsNullOrEmpty(_apiKey))
        {
            // Ensure header is set (may already be set via named client config)
            if (!client.DefaultRequestHeaders.Contains("X-API-Key"))
                client.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
        }
        return client;
    }
}

// ── Models ──

public class FXNotificationTask
{
    public int Id { get; set; }
    public string TaskCode { get; set; } = "";
    public string? TaskName { get; set; }
    public string? Description { get; set; }
    public string? Channel { get; set; }
    public bool IsActive { get; set; }
}

public class FXQueueResult
{
    public bool Success { get; set; }
    public int? Id { get; set; }
    public string? Error { get; set; }
}

public class FXNotificationStatus
{
    public int Id { get; set; }
    public string? Status { get; set; }
    public string? SentAt { get; set; }
    public string? Error { get; set; }
}

public class FXHealthResult
{
    public bool IsHealthy { get; set; }
    public string? BaseUrl { get; set; }
    public bool HasApiKey { get; set; }
    public string? Error { get; set; }
}
