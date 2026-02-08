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
    private readonly IPermissionService _permissionService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IGatewayService gatewayService,
        IUserScopeService scopeService,
        IChatService chatService,
        IProjectService projectService,
        IPermissionService permissionService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<ChatController> logger)
    {
        _gatewayService = gatewayService;
        _scopeService = scopeService;
        _chatService = chatService;
        _projectService = projectService;
        _permissionService = permissionService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get list of projects the user can chat about
    /// </summary>
    [HttpGet("projects")]
    public async Task<IActionResult> GetChatProjects()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        // Check global chat access first (project-level checked per-project below)
        var chatAccess = await _permissionService.GetEffectiveChatAccess(userId.Value, null);
        if (chatAccess == "none")
        {
            // Even if global is "none", user might have project-level chat access
            // Let them through — they'll only see projects where they have access
        }

        // Get user's email for scope check
        var email = User.FindFirst("email")?.Value ?? "";
        var scope = _scopeService.GetUserScope(email);

        // Get all projects
        var allProjects = await _projectService.GetProjectsAsync();

        // Filter: admin sees all, others see their own + repos they have access to
        List<object> projects;
        if (scope.Role == "admin" || scope.Repos.Contains("*"))
        {
            projects = allProjects.Select(p => new { p.Id, p.Name, p.Slug, p.RepoFullName }).Cast<object>().ToList();
        }
        else
        {
            projects = allProjects
                .Where(p => p.CreatedByUserId == userId.Value || scope.Repos.Any(r =>
                    p.RepoFullName.EndsWith("/" + r, StringComparison.OrdinalIgnoreCase) ||
                    p.RepoFullName.Equals(r, StringComparison.OrdinalIgnoreCase)))
                .Select(p => new { p.Id, p.Name, p.Slug, p.RepoFullName })
                .Cast<object>()
                .ToList();
        }

        return Ok(projects);
    }

    /// <summary>
    /// Get a Deepgram API token for real-time speech-to-text.
    /// The actual API key stays server-side; client gets it only via this auth-gated endpoint.
    /// </summary>
    [HttpGet("deepgram-token")]
    public IActionResult GetDeepgramToken()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var apiKey = _configuration["Deepgram:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("Deepgram API key not configured");
            return StatusCode(503, new { error = "Speech-to-text not configured" });
        }

        return Ok(new { token = apiKey });
    }

    /// <summary>
    /// Text-to-speech via Deepgram Aura. Returns audio/mpeg stream.
    /// </summary>
    [HttpPost("tts")]
    public async Task<IActionResult> TextToSpeech([FromBody] TtsRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "Text is required" });

        var apiKey = _configuration["Deepgram:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            return StatusCode(503, new { error = "TTS not configured" });

        var model = request.Voice ?? "aura-asteria-en"; // asteria = female voice
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Token {apiKey}");

        var payload = new StringContent(
            System.Text.Json.JsonSerializer.Serialize(new { text = request.Text }),
            System.Text.Encoding.UTF8, "application/json");

        var response = await client.PostAsync(
            $"https://api.deepgram.com/v1/speak?model={model}&encoding=mp3",
            payload);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            _logger.LogError("Deepgram TTS failed: {Status} {Body}", response.StatusCode, body);
            return StatusCode(502, new { error = "TTS failed" });
        }

        var audioStream = await response.Content.ReadAsStreamAsync();
        return File(audioStream, "audio/mpeg");
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

        // Get user's project — use specified projectId or fall back to default
        var project = request.ProjectId.HasValue
            ? await _projectService.GetProjectAsync(request.ProjectId.Value)
            : await _projectService.GetProjectForUserAsync(userId.Value);

        // Check chat access (project-scoped if available)
        var chatAccess = await _permissionService.GetEffectiveChatAccess(userId.Value, project?.Id);
        if (chatAccess == "none")
        {
            Response.StatusCode = 403;
            await Response.WriteAsync(JsonSerializer.Serialize(new { error = "No chat access" }));
            return;
        }

        // Require a project context — don't allow unscoped chat
        if (project == null)
        {
            Response.StatusCode = 400;
            await Response.WriteAsync(JsonSerializer.Serialize(new { error = "Please select a project first. Chat requires a project context." }));
            return;
        }

        // Validate access if a specific project was requested
        if (request.ProjectId.HasValue && project != null)
        {
            var email = User.FindFirst("email")?.Value ?? "";
            var scope = _scopeService.GetUserScope(email);
            if (scope.Role != "admin" && !scope.Repos.Contains("*") &&
                project.CreatedByUserId != userId.Value &&
                !scope.Repos.Any(r =>
                    project.RepoFullName.EndsWith("/" + r, StringComparison.OrdinalIgnoreCase) ||
                    project.RepoFullName.Equals(r, StringComparison.OrdinalIgnoreCase)))
            {
                Response.StatusCode = 403;
                await Response.WriteAsync(JsonSerializer.Serialize(new { error = "No access to this project" }));
                return;
            }
        }

        var projectName = project?.Name;
        var repoFullName = project?.RepoFullName;
        var projectSlug = project?.Slug;
        var projectBrief = project?.ProjectBrief;

        // Get user identity for system prompt
        var userEmail = User.FindFirst("email")?.Value;
        var userDisplayName = User.Identity?.Name;

        // Build session key and system prompt
        var sessionKey = _chatService.BuildSessionKey(userId.Value, projectSlug);
        var systemPrompt = _chatService.BuildSystemPrompt(chatAccess, projectName, repoFullName, projectBrief, userDisplayName, userEmail);

        // Save user message (text only — no base64 images in DB)
        var messageToSave = request.Message;
        if (!string.IsNullOrEmpty(request.ImageDataUrl))
            messageToSave = string.IsNullOrEmpty(request.Message) ? "[Image]" : request.Message + "\n[Image attached]";
        await _chatService.SaveMessage(userId.Value, sessionKey, "user", messageToSave);

        // Load recent history for context
        var history = await _chatService.GetHistory(userId.Value, sessionKey, 20);

        // Build messages array for gateway
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        // Add history messages (text-only, last message is the current one)
        foreach (var msg in history.Take(history.Count - 1))
        {
            messages.Add(new { role = msg.Role, content = msg.Content });
        }

        // Add the current user message — with optional image in OpenAI vision format
        if (!string.IsNullOrEmpty(request.ImageDataUrl))
        {
            var contentParts = new List<object>();
            if (!string.IsNullOrEmpty(request.Message))
            {
                contentParts.Add(new { type = "text", text = request.Message });
            }
            contentParts.Add(new { type = "image_url", image_url = new { url = request.ImageDataUrl } });
            messages.Add(new { role = "user", content = contentParts });
        }
        else
        {
            messages.Add(new { role = "user", content = request.Message });
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
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 50, [FromQuery] int? projectId = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var project = projectId.HasValue
            ? await _projectService.GetProjectAsync(projectId.Value)
            : await _projectService.GetProjectForUserAsync(userId.Value);

        var chatAccess = await _permissionService.GetEffectiveChatAccess(userId.Value, project?.Id);

        var sessionKey = _chatService.BuildSessionKey(userId.Value, project?.Slug);

        var messages = await _chatService.GetHistory(userId.Value, sessionKey, limit);

        return Ok(new ChatHistoryResponse
        {
            Messages = messages,
            ChatAccess = chatAccess,
            ProjectName = project?.Name,
            RepoFullName = project?.RepoFullName,
            ProjectId = project?.Id
        });
    }

    /// <summary>
    /// Clear chat history (start new conversation)
    /// </summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory([FromQuery] int? projectId = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var project = projectId.HasValue
            ? await _projectService.GetProjectAsync(projectId.Value)
            : await _projectService.GetProjectForUserAsync(userId.Value);

        var sessionKey = _chatService.BuildSessionKey(userId.Value, project?.Slug);

        await _chatService.ClearHistory(userId.Value, sessionKey);

        return Ok(new { message = "Chat history cleared" });
    }

    /// <summary>
    /// Get user's chat access level and project info
    /// </summary>
    [HttpGet("access")]
    public async Task<IActionResult> GetAccess([FromQuery] int? projectId = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var project = projectId.HasValue
            ? await _projectService.GetProjectAsync(projectId.Value)
            : await _projectService.GetProjectForUserAsync(userId.Value);

        var chatAccess = await _permissionService.GetEffectiveChatAccess(userId.Value, project?.Id);

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

    #region Full Chat (Direct Synthia Access)

    /// <summary>
    /// Check if user has full chat access
    /// </summary>
    [HttpGet("full/access")]
    public async Task<IActionResult> GetFullChatAccess()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var hasAccess = await _permissionService.HasFullChatAccess(userId.Value);
        return Ok(new { hasAccess });
    }

    /// <summary>
    /// Stream chat with Synthia directly (proxies to Clawdbot gateway)
    /// </summary>
    [HttpPost("full/stream")]
    public async Task StreamFullChat([FromBody] FullChatRequest request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            Response.StatusCode = 401;
            return;
        }

        // Check full chat access permission
        var hasAccess = await _permissionService.HasFullChatAccess(userId.Value);
        if (!hasAccess)
        {
            Response.StatusCode = 403;
            await Response.WriteAsync("{\"error\": \"Full chat access required\"}");
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        try
        {
            // Get user info for session key
            var email = User.FindFirst("email")?.Value ?? "";
            var displayName = User.FindFirst("displayName")?.Value ?? email;
            
            // Build session key for this user's full chat
            var sessionKey = $"web-full-{userId.Value}";

            // Get gateway config
            var gatewayUrl = _configuration["Gateway:Url"] ?? "http://127.0.0.1:18789";
            var gatewayToken = _configuration["Gateway:Token"] ?? "";

            // Build messages array
            var messages = new List<object>();

            // Add history from request if provided
            if (request.History != null)
            {
                foreach (var msg in request.History)
                {
                    messages.Add(new { role = msg.Role, content = msg.Content });
                }
            }

            // Add current message
            messages.Add(new { role = "user", content = request.Message });

            // Build request to Clawdbot gateway
            // Agent is configurable: FullChat:AgentId (default: "vip" for compartmentalized workspace)
            var agentId = _configuration["FullChat:AgentId"] ?? "vip";
            var gatewayRequest = new
            {
                model = $"clawdbot:{agentId}",
                messages,
                stream = true,
                user = sessionKey
            };

            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromMinutes(5);

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{gatewayUrl}/v1/chat/completions");
            httpRequest.Content = new StringContent(
                JsonSerializer.Serialize(gatewayRequest),
                Encoding.UTF8,
                "application/json"
            );
            
            if (!string.IsNullOrEmpty(gatewayToken))
            {
                httpRequest.Headers.Add("Authorization", $"Bearer {gatewayToken}");
            }

            using var response = await httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Gateway returned {StatusCode}: {Body}", response.StatusCode, errorBody);
                await Response.WriteAsync($"data: {{\"error\": \"Gateway error: {response.StatusCode}\"}}\n\n");
                await Response.WriteAsync("data: [DONE]\n\n");
                return;
            }

            using var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrEmpty(line)) continue;

                // Forward the SSE line to the client
                await Response.WriteAsync(line + "\n\n");
                await Response.Body.FlushAsync();

                if (line == "data: [DONE]") break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in full chat stream for user {UserId}", userId);
            await Response.WriteAsync($"data: {{\"error\": \"Internal error\"}}\n\n");
            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }
    }

    #endregion

    /// <summary>
    /// Upload an image for chat (VIP users only)
    /// </summary>
    [HttpPost("upload-image")]
    [Authorize]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "Unauthorized" });

        // Check if user has full chat access
        if (!await _permissionService.HasFullChatAccess(userId.Value))
            return StatusCode(403, new { error = "Full chat access required" });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided" });

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" });

        // Validate file size (10MB max)
        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File too large. Max size: 10MB" });

        try
        {
            // Generate unique filename
            var ext = Path.GetExtension(file.FileName).ToLower();
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var fileName = $"chat-{userId.Value}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{ext}";

            // Save to uploads folder
            var uploadsPath = Path.Combine(AppContext.BaseDirectory, "uploads", "chat-images", DateTime.UtcNow.ToString("yyyy-MM"));
            Directory.CreateDirectory(uploadsPath);
            var filePath = Path.Combine(uploadsPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return URL
            var url = $"/api/chat/image/{DateTime.UtcNow:yyyy-MM}/{fileName}";
            return Ok(new { url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload chat image for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to upload image" });
        }
    }

    /// <summary>
    /// Serve uploaded chat image
    /// </summary>
    [HttpGet("image/{year}-{month}/{fileName}")]
    [AllowAnonymous]
    public IActionResult GetChatImage(string year, string month, string fileName)
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "uploads", "chat-images", $"{year}-{month}", fileName);
        
        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var ext = Path.GetExtension(fileName).ToLower();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return PhysicalFile(filePath, contentType);
    }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SessionKey { get; set; }
}

public class FullChatRequest
{
    public string Message { get; set; } = string.Empty;
    public List<FullChatMessage>? History { get; set; }
}

public class FullChatMessage
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}
