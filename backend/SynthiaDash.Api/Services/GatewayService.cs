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
            // The Clawdbot gateway uses WebSocket RPC, not REST.
            // HTTP requests return the Control UI (HTML) on success.
            // A 200 response means the gateway is reachable and running.
            var response = await _httpClient.GetAsync("/");
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();

                // Try JSON first (future-proofing if REST endpoints are added)
                if (body.TrimStart().StartsWith("{"))
                {
                    try
                    {
                        var doc = JsonDocument.Parse(body);
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
                    catch (JsonException) { }
                }

                // Control UI HTML response = gateway is online
                // Extract assistant name from the Control UI script tag if present
                string? host = null;
                var nameMatch = System.Text.RegularExpressions.Regex.Match(body,
                    @"__CLAWDBOT_ASSISTANT_NAME__=""([^""]+)""");
                if (nameMatch.Success)
                    host = nameMatch.Groups[1].Value;

                return new GatewayStatus
                {
                    Online = true,
                    Model = "anthropic/claude-opus-4-5",
                    Host = host ?? "FXLegal"
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
