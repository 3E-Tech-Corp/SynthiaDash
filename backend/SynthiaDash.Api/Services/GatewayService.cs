using System.Text.Json;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IGatewayService
{
    Task<GatewayStatus> GetStatusAsync();
    Task<List<SessionInfo>> GetSessionsAsync();
    Task<string> SendMessageAsync(string sessionKey, string message);
}

public class GatewayService : IGatewayService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GatewayService> _logger;

    public GatewayService(IHttpClientFactory httpClientFactory, ILogger<GatewayService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Gateway");
        _logger = logger;
    }

    public async Task<GatewayStatus> GetStatusAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/status");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                return new GatewayStatus
                {
                    Online = true,
                    Model = root.TryGetProperty("model", out var m) ? m.GetString() : null,
                    Version = root.TryGetProperty("version", out var v) ? v.GetString() : null,
                    UptimeMs = root.TryGetProperty("uptimeMs", out var u) ? u.GetInt64() : null,
                    Host = root.TryGetProperty("host", out var h) ? h.GetString() : null
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to reach gateway");
        }

        return new GatewayStatus { Online = false };
    }

    public async Task<List<SessionInfo>> GetSessionsAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/sessions");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<List<SessionInfo>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get sessions");
        }
        return new();
    }

    public async Task<string> SendMessageAsync(string sessionKey, string message)
    {
        try
        {
            var content = new StringContent(
                JsonSerializer.Serialize(new { sessionKey, message }),
                System.Text.Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/chat", content);
            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send message to gateway");
            return "Error: Could not reach Synthia";
        }
    }
}
