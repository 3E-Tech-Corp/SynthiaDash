using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using SynthiaDash.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// CORS — supports exact origins + wildcard subdomain patterns (e.g., *.synthia.bot)
builder.Services.AddCors(options =>
{
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173" };

    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                var uri = new Uri(origin);
                foreach (var allowed in origins)
                {
                    // Wildcard subdomain pattern: *.synthia.bot
                    if (allowed.Contains("*"))
                    {
                        var pattern = allowed.Replace("*.", "");
                        // Extract scheme and host pattern
                        var schemeEnd = pattern.IndexOf("://");
                        if (schemeEnd >= 0)
                        {
                            var scheme = pattern[..schemeEnd];
                            var hostPattern = pattern[(schemeEnd + 3)..];
                            if (uri.Scheme == scheme &&
                                (uri.Host == hostPattern || uri.Host.EndsWith("." + hostPattern)))
                                return true;
                        }
                    }
                    else
                    {
                        // Exact match
                        if (origin.Equals(allowed, StringComparison.OrdinalIgnoreCase))
                            return true;
                    }
                }
                return false;
            })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// JWT Authentication (shared with Funtime Identity)
var jwtKey = builder.Configuration["Jwt:Key"] ?? "default-dev-key-change-in-production";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // Don't remap claim types (keep "email" as "email")
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "SynthiaDash",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "SynthiaDashUsers",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            NameClaimType = System.Security.Claims.ClaimTypes.Name
        };
        // Log JWT auth failures for debugging
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("JwtAuth");
                logger.LogWarning("JWT auth failed: {Error} | Key length: {KeyLen}",
                    context.Exception.Message, jwtKey.Length);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireClaim("email", 
        builder.Configuration.GetSection("Admin:Emails").Get<string[]>() ?? Array.Empty<string>()));
});

// Services
builder.Services.AddHttpClient("Gateway", client =>
{
    var baseUrl = builder.Configuration["Gateway:BaseUrl"] ?? "http://localhost:18789";
    client.BaseAddress = new Uri(baseUrl);
    var token = builder.Configuration["Gateway:Token"];
    if (!string.IsNullOrEmpty(token))
    {
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
    }
});

builder.Services.AddHttpClient("GitHub", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.Add("User-Agent", "SynthiaDash");
    var token = builder.Configuration["GitHub:Token"];
    if (!string.IsNullOrEmpty(token))
    {
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
    }
});

builder.Services.AddHttpClient("FXNotification", client =>
{
    var baseUrl = builder.Configuration["FXNotification:BaseUrl"];
    if (!string.IsNullOrEmpty(baseUrl))
        client.BaseAddress = new Uri(baseUrl);
    var apiKey = builder.Configuration["FXNotification:ApiKey"];
    if (!string.IsNullOrEmpty(apiKey))
        client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
});

builder.Services.AddScoped<IGatewayService, GatewayService>();
builder.Services.AddScoped<IGitHubService, GitHubService>();
builder.Services.AddScoped<IUserScopeService, UserScopeService>();
builder.Services.AddSingleton<ITaskService, TaskService>();
builder.Services.AddSingleton<IRateLimitService, RateLimitService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddSingleton<IFXNotificationClient, FXNotificationClient>();
builder.Services.AddScoped<INotificationSettingsService, NotificationSettingsService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IFeaturedProjectService, FeaturedProjectService>();
builder.Services.AddScoped<ISoulSnapshotService, SoulSnapshotService>();
builder.Services.AddScoped<IProposalService, ProposalService>();

// Asset management (pattern from funtime-shared)
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<IAssetService, AssetService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Auto-migrate: create Users table if it doesn't exist
{
    var connStr = app.Configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrEmpty(connStr))
    {
        try
        {
            using var db = new Microsoft.Data.SqlClient.SqlConnection(connStr);
            db.Open();
            using var cmd = db.CreateCommand();
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
                BEGIN
                    CREATE TABLE Users (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        Email NVARCHAR(256) NOT NULL,
                        DisplayName NVARCHAR(128) NOT NULL,
                        PasswordHash NVARCHAR(512) NOT NULL,
                        Role NVARCHAR(20) NOT NULL DEFAULT 'viewer',
                        Repos NVARCHAR(MAX) NULL,
                        IsActive BIT NOT NULL DEFAULT 1,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        LastLoginAt DATETIME2 NULL,
                        CONSTRAINT UQ_Users_Email UNIQUE (Email)
                    );
                    CREATE INDEX IX_Users_Email ON Users(Email);
                END";
            cmd.ExecuteNonQuery();

            // Add ticket access columns if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TicketAccess')
                    ALTER TABLE Users ADD TicketAccess NVARCHAR(20) NOT NULL DEFAULT 'none';
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BugAccess')
                    ALTER TABLE Users ADD BugAccess NVARCHAR(20) NOT NULL DEFAULT 'none';
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FeatureAccess')
                    ALTER TABLE Users ADD FeatureAccess NVARCHAR(20) NOT NULL DEFAULT 'none';";
            cmd.ExecuteNonQuery();

            // Migrate old TicketAccess to new columns
            cmd.CommandText = @"
                UPDATE Users SET BugAccess = TicketAccess, FeatureAccess = TicketAccess
                WHERE BugAccess = 'none' AND FeatureAccess = 'none' AND TicketAccess != 'none';";
            cmd.ExecuteNonQuery();

            // Create Tickets table if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
                BEGIN
                    CREATE TABLE Tickets (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        UserId INT NOT NULL,
                        Type NVARCHAR(20) NOT NULL,
                        Title NVARCHAR(256) NOT NULL,
                        Description NVARCHAR(MAX) NOT NULL,
                        ImagePath NVARCHAR(512) NULL,
                        RepoFullName NVARCHAR(256) NULL,
                        Status NVARCHAR(20) NOT NULL DEFAULT 'submitted',
                        AgentTaskId NVARCHAR(50) NULL,
                        Result NVARCHAR(MAX) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CompletedAt DATETIME2 NULL,
                        CONSTRAINT FK_Tickets_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
                    );
                    CREATE INDEX IX_Tickets_UserId ON Tickets(UserId);
                    CREATE INDEX IX_Tickets_Status ON Tickets(Status);
                    CREATE INDEX IX_Tickets_CreatedAt ON Tickets(CreatedAt DESC);
                END";
            cmd.ExecuteNonQuery();
            // Create Projects table if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Projects')
                BEGIN
                    CREATE TABLE Projects (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        Name NVARCHAR(128) NOT NULL,
                        Slug NVARCHAR(64) NOT NULL,
                        Domain NVARCHAR(256) NOT NULL,
                        RepoFullName NVARCHAR(256) NOT NULL,
                        DatabaseName NVARCHAR(128) NOT NULL,
                        IisSiteName NVARCHAR(256) NOT NULL,
                        Status NVARCHAR(20) NOT NULL DEFAULT 'pending',
                        StatusDetail NVARCHAR(MAX) NULL,
                        Error NVARCHAR(MAX) NULL,
                        CreatedByUserId INT NOT NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        ReadyAt DATETIME2 NULL,
                        CONSTRAINT FK_Projects_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
                        CONSTRAINT UQ_Projects_Slug UNIQUE (Slug),
                        CONSTRAINT UQ_Projects_Domain UNIQUE (Domain)
                    );
                    CREATE INDEX IX_Projects_Status ON Projects(Status);
                END";
            cmd.ExecuteNonQuery();

            // Create TicketComments table if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TicketComments')
                BEGIN
                    CREATE TABLE TicketComments (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        TicketId INT NOT NULL,
                        UserId INT NULL,
                        UserDisplayName NVARCHAR(128) NOT NULL,
                        Comment NVARCHAR(MAX) NOT NULL,
                        IsSystemMessage BIT NOT NULL DEFAULT 0,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_TicketComments_Tickets FOREIGN KEY (TicketId) REFERENCES Tickets(Id) ON DELETE CASCADE,
                        CONSTRAINT FK_TicketComments_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
                    );
                    CREATE INDEX IX_TicketComments_TicketId ON TicketComments(TicketId);
                    CREATE INDEX IX_TicketComments_CreatedAt ON TicketComments(CreatedAt);
                END";
            cmd.ExecuteNonQuery();

            // Add ChatAccess column to Users if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ChatAccess')
                    ALTER TABLE Users ADD ChatAccess NVARCHAR(20) NOT NULL DEFAULT 'none';";
            cmd.ExecuteNonQuery();

            // Create ChatMessages table if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatMessages')
                BEGIN
                    CREATE TABLE ChatMessages (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        UserId INT NOT NULL,
                        SessionKey NVARCHAR(200) NOT NULL,
                        Role NVARCHAR(20) NOT NULL,
                        Content NVARCHAR(MAX) NOT NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_ChatMessages_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
                    );
                    CREATE INDEX IX_ChatMessages_Session ON ChatMessages(SessionKey, CreatedAt);
                END";
            cmd.ExecuteNonQuery();

            // Create DemoRequests table if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DemoRequests')
                CREATE TABLE DemoRequests (
                    Id INT IDENTITY PRIMARY KEY,
                    Email NVARCHAR(255) NOT NULL,
                    Name NVARCHAR(255) NOT NULL,
                    Reason NVARCHAR(2000) NOT NULL,
                    IpAddress NVARCHAR(45) NULL,
                    Location NVARCHAR(255) NULL,
                    Status NVARCHAR(20) DEFAULT 'pending',
                    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
                    ReviewedAt DATETIME2 NULL,
                    ReviewedBy INT NULL
                );";
            cmd.ExecuteNonQuery();

            // Add membership columns to Users (016-membership.sql)
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MembershipType')
                    ALTER TABLE Users ADD MembershipType NVARCHAR(20) NOT NULL DEFAULT 'free';
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PhoneNumber')
                    ALTER TABLE Users ADD PhoneNumber NVARCHAR(20) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmailVerified')
                    ALTER TABLE Users ADD EmailVerified BIT NOT NULL DEFAULT 0;";
            cmd.ExecuteNonQuery();

            // Create ProjectProposals tables (017-proposals.sql)
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProjectProposals')
                BEGIN
                    CREATE TABLE ProjectProposals (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        Title NVARCHAR(200) NOT NULL,
                        RawDescription NVARCHAR(MAX) NOT NULL,
                        PolishedDescription NVARCHAR(MAX) NULL,
                        Problem NVARCHAR(MAX) NULL,
                        ProposerRole NVARCHAR(50) NULL,
                        ExpectedUsers INT NULL,
                        ExpectedMonthlyValue DECIMAL(10,2) NULL,
                        ShareToken NVARCHAR(50) NOT NULL,
                        Status NVARCHAR(20) NOT NULL DEFAULT 'draft',
                        DeclineReason NVARCHAR(MAX) NULL,
                        ProposerId INT NULL REFERENCES Users(Id),
                        LikeCount INT NOT NULL DEFAULT 0,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE UNIQUE INDEX IX_Proposals_ShareToken ON ProjectProposals(ShareToken);
                    CREATE INDEX IX_Proposals_Status ON ProjectProposals(Status);
                    CREATE INDEX IX_Proposals_ProposerId ON ProjectProposals(ProposerId);
                END";
            cmd.ExecuteNonQuery();

            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalFeatures')
                BEGIN
                    CREATE TABLE ProposalFeatures (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
                        Description NVARCHAR(1000) NOT NULL,
                        AuthorId INT NULL REFERENCES Users(Id),
                        AuthorName NVARCHAR(100) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_ProposalFeatures_ProposalId ON ProposalFeatures(ProposalId);
                END";
            cmd.ExecuteNonQuery();

            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalLikes')
                BEGIN
                    CREATE TABLE ProposalLikes (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
                        UserId INT NULL REFERENCES Users(Id),
                        IsAnonymous BIT NOT NULL DEFAULT 0,
                        IpHash NVARCHAR(64) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_ProposalLikes_ProposalId ON ProposalLikes(ProposalId);
                END";
            cmd.ExecuteNonQuery();

            cmd.CommandText = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalValueEstimates')
                BEGIN
                    CREATE TABLE ProposalValueEstimates (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
                        UserId INT NULL REFERENCES Users(Id),
                        IsAnonymous BIT NOT NULL DEFAULT 0,
                        WouldPay BIT NOT NULL DEFAULT 0,
                        MonthlyAmount DECIMAL(10,2) NULL,
                        Weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_ProposalValueEstimates_ProposalId ON ProposalValueEstimates(ProposalId);
                END";
            cmd.ExecuteNonQuery();

            app.Logger.LogInformation("Database migration check complete");
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Database migration failed — auth features won't work until DB is configured");
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseCors();
app.UseWebSockets();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Deepgram WebSocket proxy (browser can't send auth headers directly)
app.Map("/api/deepgram-proxy", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("WebSocket required");
        return;
    }
    
    var deepgramKey = app.Configuration["Deepgram:ApiKey"];
    if (string.IsNullOrEmpty(deepgramKey))
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync("Deepgram API key not configured");
        return;
    }
    
    using var clientWs = await context.WebSockets.AcceptWebSocketAsync();
    using var httpClient = new HttpClient();
    
    // Build Deepgram URL with query params from original request
    var query = context.Request.QueryString.Value ?? "";
    var dgUrl = $"wss://api.deepgram.com/v1/listen{query}";
    
    using var dgClient = new System.Net.WebSockets.ClientWebSocket();
    dgClient.Options.SetRequestHeader("Authorization", $"Token {deepgramKey}");
    
    try
    {
        await dgClient.ConnectAsync(new Uri(dgUrl), CancellationToken.None);
        
        // Bidirectional proxy
        var clientToServer = Task.Run(async () =>
        {
            var buffer = new byte[8192];
            while (clientWs.State == System.Net.WebSockets.WebSocketState.Open)
            {
                var result = await clientWs.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                    break;
                await dgClient.SendAsync(new ArraySegment<byte>(buffer, 0, result.Count), 
                    result.MessageType, result.EndOfMessage, CancellationToken.None);
            }
        });
        
        var serverToClient = Task.Run(async () =>
        {
            var buffer = new byte[8192];
            while (dgClient.State == System.Net.WebSockets.WebSocketState.Open)
            {
                var result = await dgClient.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                    break;
                await clientWs.SendAsync(new ArraySegment<byte>(buffer, 0, result.Count),
                    result.MessageType, result.EndOfMessage, CancellationToken.None);
            }
        });
        
        await Task.WhenAny(clientToServer, serverToClient);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Deepgram proxy error");
    }
    finally
    {
        if (clientWs.State == System.Net.WebSockets.WebSocketState.Open)
            await clientWs.CloseAsync(System.Net.WebSockets.WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
        if (dgClient.State == System.Net.WebSockets.WebSocketState.Open)
            await dgClient.CloseAsync(System.Net.WebSockets.WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
    }
});

app.Run();
