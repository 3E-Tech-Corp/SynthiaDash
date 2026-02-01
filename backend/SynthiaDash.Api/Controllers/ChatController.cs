using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IGatewayService _gatewayService;
    private readonly IUserScopeService _scopeService;
    private readonly IChatService _chatService;
    private readonly IProjectService _projectService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IGatewayService gatewayService,
        IUserScopeService scopeService,
        IChatService chatService,
        IProjectService projectService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<ChatController> logger)
    {
        _gatewayService = gatewayService;
        _scopeService = scopeService;
        _chatService = chatService;
        _projectService = projectService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Legacy: Send a message to Synthia, scoped to the user's repos (non-streaming)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] ChatRequest request)
    {
        var email = User.FindFirst("email")?.Value ?? "";
        var scope = _scopeService.GetUserScope(email);

        if (scope.Role == "none")
            return Forbid();

        var scopedMessage = $"[Dashboard: {email} | Role: {scope.Role} | Repos: {string.Join(", ", scope.Repos)}]\n{request.Message}";

        var response = await _gatewayService.SendMessageAsync(
            request.SessionKey ?? $"dash-{email}",
            scopedMessage);

        return Ok(new { response });
    }

    /// <summary>
    /// Streaming chat: Send a message and receive SSE stream back
    /// </summary>
    [HttpPost("send")]
    public async Task SendChat([FromBody] SendChatRequest request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            Response.StatusCode = 401;
            return;
        }

        // Check chat access
        var chatAccess = await _chatService.GetUserChatAccess(userId.Value);
        if (chatAccess == "none")
        {
            Response.StatusCode = 403;
            await Response.WriteAsync(JsonSerializer.Serialize(new { error = "No chat access" }));
            return;
        }

        // Get user's project
        var project = await _projectService.GetProjectForUserAsync(userId.Value);
        var projectName = project?.Name;
        var repoFullName = project?.RepoFullName;
        var projectSlug = project?.Slug;
        var projectBrief = project?.ProjectBrief;

        // Build session key and system prompt
        var sessionKey = _chatService.BuildSessionKey(userId.Value, projectSlug);
        var systemPrompt = _chatService.BuildSystemPrompt(chatAccess, projectName, repoFullName, projectBrief);

        // Save user message
        await _chatService.SaveMessage(userId.Value, sessionKey, "user", request.Message);

        // Load recent history for context
        var history = await _chatService.GetHistory(userId.Value, sessionKey, 20);

        // Build messages array for gateway
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        foreach (var msg in history)
        {
            messages.Add(new { role = msg.Role, content = msg.Content });
        }

        // Set up SSE response
        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var fullResponse = new StringBuilder();

        try
        {
            var gatewayClient = _httpClientFactory.CreateClient("Gateway");
            var gatewayPayload = new
            {
                model = "clawdbot",
                stream = true,
                user = sessionKey,
                messages
            };

            var jsonContent = new StringContent(
                JsonSerializer.Serialize(gatewayPayload),
                Encoding.UTF8, "application/json");

            var gatewayRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
            {
                Content = jsonContent
            };

            var gatewayResponse = await gatewayClient.SendAsync(gatewayRequest, HttpCompletionOption.ResponseHeadersRead);

            if (!gatewayResponse.IsSuccessStatusCode)
            {
                var errorBody = await gatewayResponse.Content.ReadAsStringAsync();
                _logger.LogError("Gateway returned {Status}: {Body}", gatewayResponse.StatusCode, errorBody);
                await Response.WriteAsync($"data: {{\"error\": \"Gateway error: {gatewayResponse.StatusCode}\"}}\n\n");
                await Response.WriteAsync("data: [DONE]\n\n");
                await Response.Body.FlushAsync();
                return;
            }

            using var stream = await gatewayResponse.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrEmpty(line)) continue;

                if (line.StartsWith("data: "))
                {
                    var data = line["data: ".Length..];

                    if (data == "[DONE]")
                    {
                        await Response.WriteAsync("data: [DONE]\n\n");
                        await Response.Body.FlushAsync();
                        break;
                    }

                    // Parse the SSE chunk to extract content delta
                    try
                    {
                        var chunk = JsonDocument.Parse(data);
                        var choices = chunk.RootElement.GetProperty("choices");
                        foreach (var choice in choices.EnumerateArray())
                        {
                            if (choice.TryGetProperty("delta", out var delta) &&
                                delta.TryGetProperty("content", out var content))
                            {
                                var text = content.GetString();
                                if (!string.IsNullOrEmpty(text))
                                {
                                    fullResponse.Append(text);
                                }
                            }
                        }
                    }
                    catch (JsonException)
                    {
                        // Not valid JSON, skip
                    }

                    // Forward the raw SSE line to the client
                    await Response.WriteAsync(line + "\n\n");
                    await Response.Body.FlushAsync();
                }
            }

            // Save assistant response
            if (fullResponse.Length > 0)
            {
                await _chatService.SaveMessage(userId.Value, sessionKey, "assistant", fullResponse.ToString());
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat for user {UserId}", userId);
            await Response.WriteAsync($"data: {{\"error\": \"Internal error\"}}\n\n");
            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }
    }

    /// <summary>
    /// Get chat history
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var chatAccess = await _chatService.GetUserChatAccess(userId.Value);
        var project = await _projectService.GetProjectForUserAsync(userId.Value);
        var sessionKey = _chatService.BuildSessionKey(userId.Value, project?.Slug);

        var messages = await _chatService.GetHistory(userId.Value, sessionKey, limit);

        return Ok(new ChatHistoryResponse
        {
            Messages = messages,
            ChatAccess = chatAccess,
            ProjectName = project?.Name,
            RepoFullName = project?.RepoFullName
        });
    }

    /// <summary>
    /// Clear chat history (start new conversation)
    /// </summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var project = await _projectService.GetProjectForUserAsync(userId.Value);
        var sessionKey = _chatService.BuildSessionKey(userId.Value, project?.Slug);

        await _chatService.ClearHistory(userId.Value, sessionKey);

        return Ok(new { message = "Chat history cleared" });
    }

    /// <summary>
    /// Get user's chat access level and project info
    /// </summary>
    [HttpGet("access")]
    public async Task<IActionResult> GetAccess()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var chatAccess = await _chatService.GetUserChatAccess(userId.Value);
        var project = await _projectService.GetProjectForUserAsync(userId.Value);

        return Ok(new
        {
            chatAccess,
            projectName = project?.Name,
            repoFullName = project?.RepoFullName
        });
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst("userId")?.Value;
        if (int.TryParse(userIdClaim, out var userId))
            return userId;
        return null;
    }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SessionKey { get; set; }
}
