using System.Net.WebSockets;
using System.Text;

namespace SynthiaDash.Api.Services;

/// <summary>
/// WebSocket middleware that proxies audio from browser to Deepgram.
/// Browser connects to /api/deepgram-proxy, we connect to Deepgram with Authorization header.
/// </summary>
public class DeepgramProxyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeepgramProxyMiddleware> _logger;

    public DeepgramProxyMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<DeepgramProxyMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only handle WebSocket requests to our proxy endpoint
        // Check both with and without /api prefix (IIS virtual app may or may not strip it)
        var path = context.Request.Path.Value ?? "";
        var isProxyPath = path.Contains("deepgram-proxy", StringComparison.OrdinalIgnoreCase);
        
        if (isProxyPath && context.WebSockets.IsWebSocketRequest)
        {
            _logger.LogInformation("Deepgram proxy: Matched path {Path}", path);
            // For WebSocket, check for token in query string since headers aren't available
            var token = context.Request.Query["token"].FirstOrDefault();
            var isAuthenticated = context.User.Identity?.IsAuthenticated ?? false;
            
            if (!isAuthenticated && string.IsNullOrEmpty(token))
            {
                _logger.LogWarning("Deepgram proxy: No authentication provided");
                context.Response.StatusCode = 401;
                return;
            }

            await HandleWebSocketProxy(context);
        }
        else
        {
            await _next(context);
        }
    }

    private async Task HandleWebSocketProxy(HttpContext context)
    {
        var apiKey = _configuration["Deepgram:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            apiKey = "7b6dcb8a7b12b97ab4196cec7ee1163ac8f792c7";
        }

        // Parse query params for Deepgram options, stripping our auth token
        var queryParams = context.Request.Query
            .Where(kv => kv.Key != "token")
            .Select(kv => $"{kv.Key}={kv.Value}");
        var queryString = string.Join("&", queryParams);
        if (!string.IsNullOrEmpty(queryString)) queryString = "?" + queryString;
        var deepgramUrl = $"wss://api.deepgram.com/v1/listen{queryString}";
        
        _logger.LogInformation("Deepgram proxy: Opening connection to {Url}", deepgramUrl);

        WebSocket? browserSocket = null;
        ClientWebSocket? deepgramClient = null;
        
        try
        {
            // Accept the browser WebSocket
            browserSocket = await context.WebSockets.AcceptWebSocketAsync();
            _logger.LogInformation("Deepgram proxy: Browser connected");
            
            // Connect to Deepgram with Authorization header
            deepgramClient = new ClientWebSocket();
            deepgramClient.Options.SetRequestHeader("Authorization", $"Token {apiKey}");
            
            using var connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await deepgramClient.ConnectAsync(new Uri(deepgramUrl), connectCts.Token);
            _logger.LogInformation("Deepgram proxy: Connected to Deepgram, state: {State}", deepgramClient.State);

            // Create a linked cancellation token that cancels when either side closes
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);

            // Run both directions concurrently
            var browserToDeepgramTask = Task.Run(async () =>
            {
                var buffer = new byte[8192];
                var chunkCount = 0;
                try
                {
                    while (browserSocket.State == WebSocketState.Open && 
                           deepgramClient.State == WebSocketState.Open &&
                           !cts.Token.IsCancellationRequested)
                    {
                        var result = await browserSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                        
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            _logger.LogInformation("Deepgram proxy: Browser sent close");
                            break;
                        }

                        if (result.Count > 0 && deepgramClient.State == WebSocketState.Open)
                        {
                            chunkCount++;
                            if (chunkCount <= 3 || chunkCount % 50 == 0)
                                _logger.LogInformation("Deepgram proxy: Forwarding chunk #{Count} ({Bytes} bytes) to Deepgram", chunkCount, result.Count);
                            
                            await deepgramClient.SendAsync(
                                new ArraySegment<byte>(buffer, 0, result.Count),
                                result.MessageType,
                                result.EndOfMessage,
                                cts.Token);
                        }
                    }
                }
                catch (OperationCanceledException) { }
                catch (WebSocketException ex)
                {
                    _logger.LogWarning("Deepgram proxy: Browser->Deepgram error: {Message}", ex.Message);
                }
                _logger.LogInformation("Deepgram proxy: Browser->Deepgram task ended (sent {Count} chunks)", chunkCount);
            });

            var deepgramToBrowserTask = Task.Run(async () =>
            {
                var buffer = new byte[8192];
                var messageCount = 0;
                try
                {
                    while (deepgramClient.State == WebSocketState.Open && 
                           browserSocket.State == WebSocketState.Open &&
                           !cts.Token.IsCancellationRequested)
                    {
                        var result = await deepgramClient.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                        
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            _logger.LogInformation("Deepgram proxy: Deepgram sent close");
                            break;
                        }

                        if (result.Count > 0 && browserSocket.State == WebSocketState.Open)
                        {
                            messageCount++;
                            var text = result.MessageType == WebSocketMessageType.Text 
                                ? Encoding.UTF8.GetString(buffer, 0, Math.Min(result.Count, 200)) 
                                : "(binary)";
                            _logger.LogInformation("Deepgram proxy: Forwarding message #{Count} to browser: {Text}...", messageCount, text);
                            
                            await browserSocket.SendAsync(
                                new ArraySegment<byte>(buffer, 0, result.Count),
                                result.MessageType,
                                result.EndOfMessage,
                                cts.Token);
                        }
                    }
                }
                catch (OperationCanceledException) { }
                catch (WebSocketException ex)
                {
                    _logger.LogWarning("Deepgram proxy: Deepgram->Browser error: {Message}", ex.Message);
                }
                _logger.LogInformation("Deepgram proxy: Deepgram->Browser task ended (received {Count} messages)", messageCount);
            });

            // Wait for both tasks or until one fails
            await Task.WhenAny(browserToDeepgramTask, deepgramToBrowserTask);
            
            // Give the other task a moment to finish gracefully
            cts.Cancel();
            await Task.WhenAll(
                Task.WhenAny(browserToDeepgramTask, Task.Delay(1000)),
                Task.WhenAny(deepgramToBrowserTask, Task.Delay(1000))
            );

            _logger.LogInformation("Deepgram proxy: Session ended");
        }
        catch (WebSocketException ex)
        {
            _logger.LogError(ex, "Deepgram proxy: WebSocket error");
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Deepgram proxy: Cancelled");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deepgram proxy: Unexpected error");
        }
        finally
        {
            // Clean up
            if (browserSocket?.State == WebSocketState.Open)
            {
                try { await browserSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Proxy closed", CancellationToken.None); }
                catch { }
            }
            browserSocket?.Dispose();
            
            if (deepgramClient?.State == WebSocketState.Open)
            {
                try { await deepgramClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Proxy closed", CancellationToken.None); }
                catch { }
            }
            deepgramClient?.Dispose();
        }
    }
}

public static class DeepgramProxyMiddlewareExtensions
{
    public static IApplicationBuilder UseDeepgramProxy(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<DeepgramProxyMiddleware>();
    }
}
