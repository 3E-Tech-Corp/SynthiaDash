using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using SynthiaDash.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:5173" };
        policy.WithOrigins(origins)
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

            // Add TicketAccess column if missing
            cmd.CommandText = @"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TicketAccess')
                    ALTER TABLE Users ADD TicketAccess NVARCHAR(20) NOT NULL DEFAULT 'none';";
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

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
