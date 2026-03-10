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
        if (context.Request.Path.StartsWithSegments("/deepgram-proxy") && context.WebSockets.IsWebSocketRequest)
        {
            // Check authentication (optional - remove if you want public access)
            if (!context.User.Identity?.IsAuthenticated ?? true)
            {
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

        // Parse query params for Deepgram options
        var queryString = context.Request.QueryString.Value ?? "";
        var deepgramUrl = $"wss://api.deepgram.com/v1/listen{queryString}";
        
        _logger.LogInformation("Opening Deepgram proxy connection to {Url}", deepgramUrl);

        // Accept the browser WebSocket
        using var browserSocket = await context.WebSockets.AcceptWebSocketAsync();
        
        // Connect to Deepgram with Authorization header
        using var deepgramClient = new ClientWebSocket();
        deepgramClient.Options.SetRequestHeader("Authorization", $"Token {apiKey}");
        
        try
        {
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await deepgramClient.ConnectAsync(new Uri(deepgramUrl), cts.Token);
            _logger.LogInformation("Connected to Deepgram");

            // Proxy data in both directions
            var browserToDeepgram = ProxyAsync(browserSocket, deepgramClient, "Browser->Deepgram", context.RequestAborted);
            var deepgramToBrowser = ProxyAsync(deepgramClient, browserSocket, "Deepgram->Browser", context.RequestAborted);

            // Wait for either direction to complete (connection closed)
            await Task.WhenAny(browserToDeepgram, deepgramToBrowser);
            
            _logger.LogInformation("Deepgram proxy session ended");
        }
        catch (WebSocketException ex)
        {
            _logger.LogError(ex, "WebSocket error in Deepgram proxy");
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Deepgram proxy connection timed out or cancelled");
        }
        finally
        {
            // Clean up
            if (browserSocket.State == WebSocketState.Open)
            {
                try
                {
                    await browserSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Proxy closed", CancellationToken.None);
                }
                catch { }
            }
            
            if (deepgramClient.State == WebSocketState.Open)
            {
                try
                {
                    await deepgramClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Proxy closed", CancellationToken.None);
                }
                catch { }
            }
        }
    }

    private async Task ProxyAsync(WebSocket source, WebSocket destination, string direction, CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        
        try
        {
            while (source.State == WebSocketState.Open && destination.State == WebSocketState.Open)
            {
                var result = await source.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("{Direction}: Close received", direction);
                    break;
                }

                if (destination.State == WebSocketState.Open)
                {
                    await destination.SendAsync(
                        new ArraySegment<byte>(buffer, 0, result.Count),
                        result.MessageType,
                        result.EndOfMessage,
                        cancellationToken);
                }
            }
        }
        catch (WebSocketException ex) when (ex.WebSocketErrorCode == WebSocketError.ConnectionClosedPrematurely)
        {
            _logger.LogInformation("{Direction}: Connection closed", direction);
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{Direction}: Proxy error", direction);
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
