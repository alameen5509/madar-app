using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Madar.Application;
using Madar.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Services
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!))
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(
                  "http://localhost:3000",
                  "https://localhost:3000",
                  "https://madar-web-ten.vercel.app")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();

// Swagger with JWT support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Madar API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}"
    });
    c.AddSecurityRequirement(new()
    {
        {
            new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Auto-create missing tables and columns
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Madar.Infrastructure.Persistence.MadarDbContext>();
    string[] sqls = [
        // Missing columns on SmartTasks
        "ALTER TABLE SmartTasks ADD COLUMN Cost DECIMAL(18,2) NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN CostCurrency VARCHAR(10) NULL DEFAULT 'SAR';",
        "ALTER TABLE SmartTasks ADD COLUMN AssignedToId CHAR(36) NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN ProjectId CHAR(36) NULL;",
        // Habits table
        @"CREATE TABLE IF NOT EXISTS Habits (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            OwnerId CHAR(36) NOT NULL,
            Title VARCHAR(300) NOT NULL,
            Icon VARCHAR(10) NOT NULL DEFAULT '⭐',
            Category VARCHAR(50) NOT NULL DEFAULT 'worship',
            IsIdea TINYINT(1) NOT NULL DEFAULT 0,
            Streak INT NOT NULL DEFAULT 0,
            LastCompletedDate DATETIME(6) NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        );",
        // Projects table
        @"CREATE TABLE IF NOT EXISTS Projects (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            OwnerId CHAR(36) NOT NULL,
            Title VARCHAR(400) NOT NULL,
            Description TEXT NULL,
            Budget DECIMAL(18,2) NOT NULL DEFAULT 0,
            Currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            UpdatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        );",
        // DeviceTokens table
        @"CREATE TABLE IF NOT EXISTS DeviceTokens (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Token VARCHAR(512) NOT NULL,
            Platform VARCHAR(20) NOT NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        );",
        // NotificationPreferences table
        @"CREATE TABLE IF NOT EXISTS NotificationPreferences (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            OverdueTasks TINYINT(1) NOT NULL DEFAULT 1,
            PrayerReminders TINYINT(1) NOT NULL DEFAULT 1,
            HabitReminders TINYINT(1) NOT NULL DEFAULT 1,
            InboxMessages TINYINT(1) NOT NULL DEFAULT 1,
            PrayerReminderMinutesBefore INT NOT NULL DEFAULT 15
        );",
        // WatchLinkRequests table
        @"CREATE TABLE IF NOT EXISTS WatchLinkRequests (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            DeviceId VARCHAR(200) NOT NULL,
            DeviceName VARCHAR(200) NULL,
            Status VARCHAR(20) NULL,
            UserId CHAR(36) NULL,
            ExpiresAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        );",
    ];
    foreach (var sql in sqls)
    {
        try { db.Database.ExecuteSqlRaw(sql); } catch { /* table/column may exist */ }
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseSerilogRequestLogging();
app.UseCors("FrontendPolicy");
// HTTPS redirection disabled on Azure (TLS termination handled by the load balancer)
if (!app.Environment.IsProduction()) app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Auto-create prayer tracking tables if missing
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Madar.Infrastructure.Persistence.MadarDbContext>();
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS PrayerLogs (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Date DATE NOT NULL,
                Prayer VARCHAR(20) NOT NULL,
                Status VARCHAR(20) NOT NULL DEFAULT 'None',
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX IX_PrayerLogs_OwnerId_Date_Prayer (OwnerId, Date, Prayer)
            );
            CREATE TABLE IF NOT EXISTS PrayerPenalties (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Date DATE NOT NULL,
                Prayer VARCHAR(20) NOT NULL,
                PenaltyType VARCHAR(50) NOT NULL DEFAULT 'surah',
                PenaltyDetail VARCHAR(200) NULL,
                Fulfilled TINYINT(1) NOT NULL DEFAULT 0,
                FulfilledAt DATETIME(6) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_PrayerPenalties_OwnerId_Fulfilled (OwnerId, Fulfilled)
            );
            CREATE TABLE IF NOT EXISTS PrayerSettings (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                PenaltyConfigJson LONGTEXT NOT NULL,
                NotificationsEnabled TINYINT(1) NOT NULL DEFAULT 1,
                UNIQUE INDEX IX_PrayerSettings_OwnerId (OwnerId)
            );");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Prayer tables auto-create skipped (may already exist)");
    }
}

app.Run();
