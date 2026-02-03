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

builder.Services.AddScoped<IGatewayService, GatewayService>();
builder.Services.AddScoped<IGitHubService, GitHubService>();
builder.Services.AddScoped<IUserScopeService, UserScopeService>();
builder.Services.AddSingleton<ITaskService, TaskService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IFeaturedProjectService, FeaturedProjectService>();

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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
