using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Madar.Application;
using Madar.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// PostgreSQL legacy timestamp behavior (allows DateTime.Kind = Unspecified)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

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
var connStr = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? "";
if (!string.IsNullOrEmpty(connStr))
{
    builder.Services.AddHealthChecks()
        .AddNpgSql(connStr, name: "supabase", tags: new[] { "db", "postgres" });
}
else
{
    builder.Services.AddHealthChecks();
}

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

// Seed roles on startup
using (var scope = app.Services.CreateScope())
{
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    string[] roles = ["User", "BusinessOwner", "Admin"];
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid> { Name = role });
    }
}

// Auto-create missing tables and columns
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Madar.Infrastructure.Persistence.MadarDbContext>();
    string[] sqls = [
        "ALTER TABLE WebProjects ADD COLUMN Priority VARCHAR(20) NOT NULL DEFAULT 'medium';",
        "ALTER TABLE WebProjects ADD COLUMN DueDate VARCHAR(20) NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN Cost DECIMAL(18,2) NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN CostCurrency VARCHAR(10) NULL DEFAULT 'SAR';",
        "ALTER TABLE SmartTasks ADD COLUMN AssignedToId CHAR(36) NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN WorkId CHAR(36) NULL;",
        "ALTER TABLE Goals ADD COLUMN WorkId CHAR(36) NULL;",
        // History date columns
        "ALTER TABLE HistoryRecords ADD COLUMN Month INT NULL;",
        "ALTER TABLE HistoryRecords ADD COLUMN Day INT NULL;",
        "ALTER TABLE HistoryRecords ADD COLUMN HijriMonth INT NULL;",
        "ALTER TABLE HistoryRecords ADD COLUMN HijriDay INT NULL;",
        "ALTER TABLE SmartTasks ADD COLUMN ProjectId CHAR(36) NULL;",
        @"CREATE TABLE IF NOT EXISTS Habits (
            Id CHAR(36) NOT NULL PRIMARY KEY, OwnerId CHAR(36) NOT NULL,
            Title VARCHAR(300) NOT NULL, Icon VARCHAR(10) NOT NULL DEFAULT '⭐',
            Category VARCHAR(50) NOT NULL DEFAULT 'worship', IsIdea TINYINT(1) NOT NULL DEFAULT 0,
            Streak INT NOT NULL DEFAULT 0, LastCompletedDate DATETIME(6) NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));",
        @"CREATE TABLE IF NOT EXISTS Projects (
            Id CHAR(36) NOT NULL PRIMARY KEY, OwnerId CHAR(36) NOT NULL,
            Title VARCHAR(400) NOT NULL, Description TEXT NULL,
            Budget DECIMAL(18,2) NOT NULL DEFAULT 0, Currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            UpdatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));",
        @"CREATE TABLE IF NOT EXISTS DeviceTokens (
            Id CHAR(36) NOT NULL PRIMARY KEY, UserId CHAR(36) NOT NULL,
            Token VARCHAR(512) NOT NULL, Platform VARCHAR(20) NOT NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));",
        @"CREATE TABLE IF NOT EXISTS NotificationPreferences (
            Id CHAR(36) NOT NULL PRIMARY KEY, UserId CHAR(36) NOT NULL,
            OverdueTasks TINYINT(1) NOT NULL DEFAULT 1, PrayerReminders TINYINT(1) NOT NULL DEFAULT 1,
            HabitReminders TINYINT(1) NOT NULL DEFAULT 1, InboxMessages TINYINT(1) NOT NULL DEFAULT 1,
            PrayerReminderMinutesBefore INT NOT NULL DEFAULT 15);",
        @"CREATE TABLE IF NOT EXISTS WatchLinkRequests (
            Id CHAR(36) NOT NULL PRIMARY KEY, DeviceId VARCHAR(200) NOT NULL,
            DeviceName VARCHAR(200) NULL, Status VARCHAR(20) NULL,
            UserId CHAR(36) NULL, ExpiresAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));",
        // Boards table (whiteboards)
        @"CREATE TABLE IF NOT EXISTS Boards (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Name VARCHAR(300) NOT NULL,
            EntityType VARCHAR(30) NOT NULL DEFAULT 'personal',
            EntityId CHAR(36) NULL,
            Data LONGTEXT NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            UpdatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_Boards_UserId (UserId),
            INDEX IX_Boards_Entity (EntityType, EntityId)
        );",
        // History tables
        @"CREATE TABLE IF NOT EXISTS HistoryRecords (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Year INT NOT NULL,
            Month INT NULL,
            Day INT NULL,
            HijriYear INT NULL,
            HijriMonth INT NULL,
            HijriDay INT NULL,
            InputType VARCHAR(10) NOT NULL DEFAULT 'gregorian',
            Title VARCHAR(500) NOT NULL,
            Description TEXT NULL,
            Figure VARCHAR(300) NULL,
            Location VARCHAR(300) NULL,
            Country VARCHAR(200) NULL,
            Category VARCHAR(50) NOT NULL DEFAULT 'other',
            StrategicImportance TEXT NULL,
            Importance VARCHAR(20) NOT NULL DEFAULT 'normal',
            Source VARCHAR(500) NULL,
            Tags VARCHAR(500) NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_HR_UserId (UserId),
            INDEX IX_HR_Year (Year),
            INDEX IX_HR_Category (Category)
        );",
        @"CREATE TABLE IF NOT EXISTS HistoryFigures (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Name VARCHAR(300) NOT NULL,
            BirthYear INT NULL,
            DeathYear INT NULL,
            Role VARCHAR(200) NULL,
            Nationality VARCHAR(200) NULL,
            Category VARCHAR(50) NULL,
            Bio TEXT NULL,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_HF_UserId (UserId)
        );",
        // Historical Events (أحداث تاريخية موثقة)
        @"CREATE TABLE IF NOT EXISTS HistoricalEvents (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Title VARCHAR(500) NOT NULL,
            GregorianDate VARCHAR(200) NULL,
            HijriDate VARCHAR(200) NULL,
            Location VARCHAR(500) NULL,
            Description TEXT NULL,
            StrategicSignificance TEXT NULL,
            OrderIndex INT NOT NULL DEFAULT 0,
            Category VARCHAR(100) NOT NULL DEFAULT '',
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_HE_UserId (UserId),
            INDEX IX_HE_Category (Category),
            INDEX IX_HE_Order (OrderIndex)
        );",
        // CircleGroups + UserCircles (new circles system)
        @"CREATE TABLE IF NOT EXISTS CircleGroups (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            Name VARCHAR(200) NOT NULL,
            Color VARCHAR(20) NULL,
            Icon VARCHAR(10) NULL,
            Priority INT NOT NULL DEFAULT 0,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_CG_UserId (UserId)
        );",
        @"CREATE TABLE IF NOT EXISTS UserCircles (
            Id CHAR(36) NOT NULL PRIMARY KEY,
            UserId CHAR(36) NOT NULL,
            GroupId CHAR(36) NOT NULL,
            Name VARCHAR(200) NOT NULL,
            Color VARCHAR(20) NULL,
            Icon VARCHAR(10) NULL,
            Slug VARCHAR(100) NULL,
            Priority INT NOT NULL DEFAULT 0,
            CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            INDEX IX_UC_UserId (UserId),
            INDEX IX_UC_GroupId (GroupId)
        );",
    ];
    foreach (var sql in sqls)
    {
        try { db.Database.ExecuteSqlRaw(sql); } catch { /* table/column may exist */ }
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseDeveloperExceptionPage();
app.UseSerilogRequestLogging();
app.UseCors("FrontendPolicy");
// HTTPS redirection disabled on Azure (TLS termination handled by the load balancer)
if (!app.Environment.IsProduction()) app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions {
    Predicate = check => check.Tags.Contains("db")
});

// Auto-apply pending EF migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Madar.Infrastructure.Persistence.MadarDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        Log.Information("Database migrations applied successfully");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Database migration skipped or failed");
    }

    // UserKV table (not in EF model, created manually)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""UserKV"" (
                ""UserId"" VARCHAR(36) NOT NULL,
                ""Key"" VARCHAR(100) NOT NULL,
                ""Value"" TEXT,
                ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (""UserId"", ""Key"")
            )");
        // LeadershipRoles + related tables (raw SQL managed)
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""LeadershipRoles"" (
                ""Id"" VARCHAR(36) NOT NULL PRIMARY KEY,
                ""UserId"" VARCHAR(36) NOT NULL,
                ""Title"" VARCHAR(300) NOT NULL,
                ""Organization"" VARCHAR(300),
                ""Sector"" VARCHAR(200),
                ""Description"" TEXT,
                ""StartDate"" TIMESTAMP,
                ""WorkId"" VARCHAR(36),
                ""ReviewFrequency"" VARCHAR(20) DEFAULT 'weekly',
                ""Color"" VARCHAR(20) DEFAULT '#5E5495',
                ""Icon"" VARCHAR(10) DEFAULT '🎯',
                ""Priority"" INT DEFAULT 0,
                ""PulseStatus"" VARCHAR(20) DEFAULT 'green',
                ""PulseNote"" TEXT,
                ""LastReviewDate"" TIMESTAMP,
                ""NextReviewDate"" TIMESTAMP,
                ""IsActive"" BOOLEAN DEFAULT TRUE,
                ""SourceId"" VARCHAR(36),
                ""CreatedAt"" TIMESTAMP DEFAULT NOW()
            )");
        await db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""LeadershipNotes"" (""Id"" VARCHAR(36) PRIMARY KEY, ""RoleId"" VARCHAR(36) NOT NULL, ""UserId"" VARCHAR(36) NOT NULL, ""Content"" TEXT, ""ConvertedTaskId"" VARCHAR(36), ""CreatedAt"" TIMESTAMP DEFAULT NOW())");
        await db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""LeadershipDevRequests"" (""Id"" VARCHAR(36) PRIMARY KEY, ""RoleId"" VARCHAR(36) NOT NULL, ""UserId"" VARCHAR(36) NOT NULL, ""Title"" VARCHAR(500), ""Description"" TEXT, ""Status"" VARCHAR(20) DEFAULT 'new', ""NextReviewDate"" TIMESTAMP, ""ReviewFrequency"" VARCHAR(20), ""CreatedAt"" TIMESTAMP DEFAULT NOW())");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Manual tables auto-create skipped");
    }
}
// ═══ Legacy MySQL table auto-creation removed — handled by EF Migrations ═══

#if MYSQL_LEGACY_DISABLED
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                `Type` VARCHAR(20) NOT NULL DEFAULT 'job',
                `Name` VARCHAR(200) NOT NULL,
                Title VARCHAR(200) NULL,
                Employer VARCHAR(200) NULL,
                Salary DECIMAL(18,2) NOT NULL DEFAULT 0,
                StartDate DATETIME(6) NULL,
                EndDate DATETIME(6) NULL,
                `Status` VARCHAR(20) NOT NULL DEFAULT 'active',
                Sector VARCHAR(100) NULL,
                `Role` VARCHAR(100) NULL,
                OwnershipPercentage DECIMAL(5,2) NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_Works_OwnerId (OwnerId)
            );
            CREATE TABLE IF NOT EXISTS WorkJobs (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                WorkId CHAR(36) NOT NULL,
                Title VARCHAR(200) NOT NULL,
                Description VARCHAR(1000) NULL,
                StartDate DATETIME(6) NULL,
                EndDate DATETIME(6) NULL,
                Salary DECIMAL(18,2) NOT NULL DEFAULT 0,
                Status VARCHAR(20) NOT NULL DEFAULT 'active',
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WorkJobs_WorkId (WorkId)
            );");

        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS JobDimensions (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                JobId CHAR(36) NOT NULL,
                ParentDimensionId CHAR(36) NULL,
                Name VARCHAR(200) NOT NULL,
                Icon VARCHAR(10) NULL,
                Color VARCHAR(20) NULL,
                Priority INT NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_JobDimensions_JobId (JobId)
            );
            CREATE TABLE IF NOT EXISTS JobGoals (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                JobId CHAR(36) NOT NULL,
                DimensionId CHAR(36) NOT NULL,
                ParentGoalId CHAR(36) NULL,
                Title VARCHAR(400) NOT NULL,
                Description VARCHAR(1000) NULL,
                DueDate DATETIME(6) NULL,
                Progress INT NOT NULL DEFAULT 0,
                Status VARCHAR(30) NOT NULL DEFAULT 'Active',
                Priority INT NOT NULL DEFAULT 0,
                Timeframe VARCHAR(50) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_JobGoals_DimensionId (DimensionId)
            );
            CREATE TABLE IF NOT EXISTS JobGoalProjects (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                GoalId CHAR(36) NOT NULL,
                ProjectId CHAR(36) NOT NULL,
                UNIQUE INDEX IX_JobGoalProjects_GoalId_ProjectId (GoalId, ProjectId)
            );
            CREATE TABLE IF NOT EXISTS JobGoalTasks (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                GoalId CHAR(36) NOT NULL,
                TaskId CHAR(36) NOT NULL,
                UNIQUE INDEX IX_JobGoalTasks_GoalId_TaskId (GoalId, TaskId)
            );");

        // ═══ Role Dimensions & Goals (mirrors Job system, RoleId = UserCircles.Id) ═══
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS RoleDimensions (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                RoleId CHAR(36) NOT NULL,
                ParentDimensionId CHAR(36) NULL,
                Name VARCHAR(200) NOT NULL,
                Icon VARCHAR(10) NULL,
                Color VARCHAR(20) NULL,
                Priority INT NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_RoleDimensions_RoleId (RoleId)
            );
            CREATE TABLE IF NOT EXISTS RoleGoals (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                RoleId CHAR(36) NOT NULL,
                DimensionId CHAR(36) NOT NULL,
                ParentGoalId CHAR(36) NULL,
                Title VARCHAR(400) NOT NULL,
                Description VARCHAR(1000) NULL,
                DueDate DATETIME(6) NULL,
                Progress INT NOT NULL DEFAULT 0,
                Status VARCHAR(30) NOT NULL DEFAULT 'Active',
                Priority INT NOT NULL DEFAULT 0,
                Timeframe VARCHAR(50) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_RoleGoals_DimensionId (DimensionId)
            );
            CREATE TABLE IF NOT EXISTS RoleGoalProjects (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                GoalId CHAR(36) NOT NULL,
                ProjectId CHAR(36) NOT NULL,
                UNIQUE INDEX IX_RoleGoalProjects_GoalId_ProjectId (GoalId, ProjectId)
            );
            CREATE TABLE IF NOT EXISTS RoleGoalTasks (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                GoalId CHAR(36) NOT NULL,
                TaskId CHAR(36) NOT NULL,
                UNIQUE INDEX IX_RoleGoalTasks_GoalId_TaskId (GoalId, TaskId)
            );");

        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS PrayerLogs (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Date DATE NOT NULL,
                Prayer VARCHAR(20) NOT NULL,
                PrayedOnTime TINYINT(1) NOT NULL DEFAULT 0,
                PrayedInMosque TINYINT(1) NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX IX_PrayerLogs_OwnerId_Date_Prayer (OwnerId, Date, Prayer)
            );
            CREATE TABLE IF NOT EXISTS PrayerPenalties (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Date DATE NOT NULL,
                Prayer VARCHAR(20) NOT NULL,
                Reason VARCHAR(30) NOT NULL DEFAULT 'not_on_time',
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

    // ═══ Phone Addiction (CBT) tables ═══
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ScreenTimeGoals (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                UserId CHAR(36) NOT NULL,
                CurrentDailyHours DECIMAL(4,1) NOT NULL DEFAULT 0,
                TargetDailyHours DECIMAL(4,1) NOT NULL DEFAULT 2,
                WeeklyReductionMinutes INT NOT NULL DEFAULT 15,
                WhyMotivation TEXT NULL,
                StartDate DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                TargetDate DATETIME(6) NULL,
                `Status` VARCHAR(20) NOT NULL DEFAULT 'active',
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_ScreenTimeGoals_UserId (UserId)
            );
            CREATE TABLE IF NOT EXISTS ScreenTimeLogs (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                UserId CHAR(36) NOT NULL,
                Date DATE NOT NULL,
                ActualMinutes INT NOT NULL DEFAULT 0,
                TargetMinutes INT NOT NULL DEFAULT 0,
                Mood VARCHAR(20) NULL,
                TopApps VARCHAR(500) NULL,
                Note VARCHAR(500) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX IX_ScreenTimeLogs_User_Date (UserId, Date)
            );
            CREATE TABLE IF NOT EXISTS PhoneTriggers (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                UserId CHAR(36) NOT NULL,
                TriggerName VARCHAR(200) NOT NULL,
                Category VARCHAR(50) NOT NULL DEFAULT 'boredom',
                Alternative VARCHAR(500) NULL,
                Frequency INT NOT NULL DEFAULT 1,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_PhoneTriggers_UserId (UserId)
            );
            CREATE TABLE IF NOT EXISTS PhoneTasks (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                UserId CHAR(36) NOT NULL,
                Title VARCHAR(500) NOT NULL,
                RecurringType VARCHAR(50) NOT NULL DEFAULT 'none',
                RecurringIntervalHours INT NULL,
                LastCompletedAt DATETIME(6) NULL,
                NextDueAt DATETIME(6) NULL,
                IsCompleted TINYINT(1) NOT NULL DEFAULT 0,
                CompletedAt DATETIME(6) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_PhoneTasks_UserId (UserId),
                INDEX IX_PhoneTasks_Due (UserId, NextDueAt)
            );
            CREATE TABLE IF NOT EXISTS PhoneFreeZones (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                UserId CHAR(36) NOT NULL,
                ZoneName VARCHAR(200) NOT NULL,
                StartTime VARCHAR(10) NOT NULL,
                EndTime VARCHAR(10) NOT NULL,
                DaysOfWeek VARCHAR(50) NOT NULL DEFAULT 'all',
                IsActive TINYINT(1) NOT NULL DEFAULT 1,
                StreakDays INT NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_PhoneFreeZones_UserId (UserId)
            );");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Phone addiction tables auto-create skipped");
    }

    // ═══ Web Projects tables ═══
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS WebProjects (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Title VARCHAR(300) NOT NULL,
                ClientName VARCHAR(200) NULL,
                Description TEXT NULL,
                CurrentPhase INT NOT NULL DEFAULT 1,
                `Status` VARCHAR(30) NOT NULL DEFAULT 'active',
                Priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                DueDate VARCHAR(20) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UpdatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebProjects_Owner (OwnerId)
            );
            CREATE TABLE IF NOT EXISTS WebProjectMembers (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                UserId CHAR(36) NULL,
                `Name` VARCHAR(200) NOT NULL,
                Email VARCHAR(200) NULL,
                `Role` VARCHAR(30) NOT NULL DEFAULT 'employee',
                AddedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebProjectMembers_Project (ProjectId),
                INDEX IX_WebProjectMembers_User (UserId)
            );
            CREATE TABLE IF NOT EXISTS WebProjectTeams (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                UserId CHAR(36) NULL,
                `Name` VARCHAR(200) NOT NULL,
                Email VARCHAR(200) NULL,
                `Role` VARCHAR(30) NOT NULL DEFAULT 'employee',
                AddedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebProjectTeams_Owner (OwnerId),
                INDEX IX_WebProjectTeams_User (UserId),
                INDEX IX_WebProjectTeams_Email (Email)
            );
            CREATE TABLE IF NOT EXISTS WebPhase1Docs (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                Content LONGTEXT NULL,
                UpdatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase1Docs_Project (ProjectId)
            );
            CREATE TABLE IF NOT EXISTS WebPhase1Tasks (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                Title VARCHAR(500) NOT NULL,
                AssignedTo VARCHAR(200) NULL,
                `Status` VARCHAR(30) NOT NULL DEFAULT 'pending',
                `Order` INT NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase1Tasks_Project (ProjectId)
            );
            CREATE TABLE IF NOT EXISTS WebPhase3Commands (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                Title VARCHAR(500) NOT NULL,
                Command LONGTEXT NULL,
                `Order` INT NOT NULL DEFAULT 0,
                `Status` VARCHAR(30) NOT NULL DEFAULT 'pending',
                DoneAt DATETIME(6) NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase3Commands_Project (ProjectId)
            );
            CREATE TABLE IF NOT EXISTS WebPhase4Credentials (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                `Type` VARCHAR(50) NOT NULL DEFAULT 'other',
                Label VARCHAR(200) NOT NULL,
                Value VARCHAR(1000) NOT NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase4Credentials_Project (ProjectId)
            );
            CREATE TABLE IF NOT EXISTS WebPhase5Commands (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                Title VARCHAR(500) NOT NULL,
                Command LONGTEXT NULL,
                `Order` INT NOT NULL DEFAULT 0,
                `Status` VARCHAR(30) NOT NULL DEFAULT 'pending',
                AddedBy CHAR(36) NULL,
                EmployeeDoneAt DATETIME(6) NULL,
                OwnerApprovedAt DATETIME(6) NULL,
                Notes TEXT NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase5Commands_Project (ProjectId)
            );
            CREATE TABLE IF NOT EXISTS WebPhase6Requests (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                ProjectId CHAR(36) NOT NULL,
                Title VARCHAR(500) NOT NULL,
                Description TEXT NULL,
                `Status` VARCHAR(30) NOT NULL DEFAULT 'new',
                ClientNote TEXT NULL,
                OwnerNote TEXT NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_WebPhase6Requests_Project (ProjectId)
            );");

        // Idempotent migration: add UserId column to existing WebProjectMembers tables
        // and backfill from AspNetUsers using case-insensitive email match.
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        try
        {
            using var check = conn.CreateCommand();
            check.CommandText = @"SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='WebProjectMembers' AND COLUMN_NAME='UserId'";
            var hasCol = Convert.ToInt32(await check.ExecuteScalarAsync()) > 0;
            if (!hasCol)
            {
                using var alter = conn.CreateCommand();
                alter.CommandText = "ALTER TABLE WebProjectMembers ADD COLUMN UserId CHAR(36) NULL, ADD INDEX IX_WebProjectMembers_User (UserId)";
                await alter.ExecuteNonQueryAsync();
                Log.Information("Added UserId column to WebProjectMembers");
            }
            // Backfill UserId for any WebProjectMembers rows missing it
            using var fill = conn.CreateCommand();
            fill.CommandText = @"UPDATE WebProjectMembers wm
                JOIN AspNetUsers u ON LOWER(TRIM(u.Email)) = LOWER(TRIM(wm.Email))
                SET wm.UserId = u.Id
                WHERE wm.UserId IS NULL AND wm.Email IS NOT NULL AND wm.Email <> ''";
            var filled = await fill.ExecuteNonQueryAsync();
            if (filled > 0) Log.Information("Backfilled UserId for {Count} WebProjectMembers rows", filled);

            // Backfill WebProjectTeams from existing per-project members:
            // each (owner, member-email/userId) pair becomes a team row, deduped.
            using var seedTeams = conn.CreateCommand();
            seedTeams.CommandText = @"
                INSERT INTO WebProjectTeams (Id, OwnerId, UserId, `Name`, Email, `Role`, AddedAt)
                SELECT UUID(), wp.OwnerId, wm.UserId, wm.`Name`, wm.Email, wm.`Role`, NOW()
                FROM WebProjectMembers wm
                JOIN WebProjects wp ON wp.Id = wm.ProjectId
                WHERE NOT EXISTS (
                    SELECT 1 FROM WebProjectTeams wt
                    WHERE wt.OwnerId = wp.OwnerId
                      AND (
                          (wm.UserId IS NOT NULL AND wt.UserId = wm.UserId)
                          OR (wm.UserId IS NULL AND wm.Email IS NOT NULL
                              AND LOWER(TRIM(wt.Email)) = LOWER(TRIM(wm.Email)))
                      )
                )";
            var seeded = await seedTeams.ExecuteNonQueryAsync();
            if (seeded > 0) Log.Information("Seeded {Count} WebProjectTeams rows from per-project members", seeded);

            // Backfill UserId on WebProjectTeams from AspNetUsers via email
            using var fillTeams = conn.CreateCommand();
            fillTeams.CommandText = @"UPDATE WebProjectTeams wt
                JOIN AspNetUsers u ON LOWER(TRIM(u.Email)) = LOWER(TRIM(wt.Email))
                SET wt.UserId = u.Id
                WHERE wt.UserId IS NULL AND wt.Email IS NOT NULL AND wt.Email <> ''";
            var filledT = await fillTeams.ExecuteNonQueryAsync();
            if (filledT > 0) Log.Information("Backfilled UserId for {Count} WebProjectTeams rows", filledT);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "WebProjectMembers UserId migration skipped");
        }
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Web projects tables auto-create skipped");
    }

    // ═══ Meetings tables ═══
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS Meetings (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                OwnerId CHAR(36) NOT NULL,
                Title VARCHAR(400) NOT NULL,
                Description VARCHAR(2000) NULL,
                MeetingType INT NOT NULL DEFAULT 0,
                Platform VARCHAR(50) NULL,
                Location VARCHAR(500) NULL,
                MeetingLink VARCHAR(500) NULL,
                StartTime DATETIME(6) NOT NULL,
                EndTime DATETIME(6) NULL,
                Status INT NOT NULL DEFAULT 0,
                Recurrence INT NOT NULL DEFAULT 0,
                ProjectId CHAR(36) NULL,
                WorkId CHAR(36) NULL,
                CircleId CHAR(36) NULL,
                Notes VARCHAR(5000) NULL,
                IsPrivate TINYINT(1) NOT NULL DEFAULT 0,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UpdatedAt DATETIME(6) NULL,
                INDEX IX_Meetings_OwnerId (OwnerId),
                INDEX IX_Meetings_StartTime (StartTime)
            );
            CREATE TABLE IF NOT EXISTS MeetingAttendees (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                MeetingId CHAR(36) NOT NULL,
                Name VARCHAR(200) NOT NULL,
                Role INT NOT NULL DEFAULT 0,
                Status INT NOT NULL DEFAULT 0,
                Notes VARCHAR(500) NULL,
                ContactId CHAR(36) NULL,
                INDEX IX_MeetingAttendees_MeetingId (MeetingId)
            );
            CREATE TABLE IF NOT EXISTS MeetingAgenda (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                MeetingId CHAR(36) NOT NULL,
                Title VARCHAR(400) NOT NULL,
                Description VARCHAR(1000) NULL,
                Duration INT NOT NULL DEFAULT 10,
                DisplayOrder INT NOT NULL DEFAULT 0,
                IsCompleted TINYINT(1) NOT NULL DEFAULT 0,
                INDEX IX_MeetingAgenda_MeetingId (MeetingId)
            );
            CREATE TABLE IF NOT EXISTS MeetingMinutes (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                MeetingId CHAR(36) NOT NULL,
                Content TEXT NOT NULL,
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX IX_MeetingMinutes_MeetingId (MeetingId)
            );
            CREATE TABLE IF NOT EXISTS MeetingActionItems (
                Id CHAR(36) NOT NULL PRIMARY KEY,
                MeetingId CHAR(36) NOT NULL,
                Title VARCHAR(400) NOT NULL,
                AssignedTo VARCHAR(200) NULL,
                DueDate DATETIME(6) NULL,
                IsCompleted TINYINT(1) NOT NULL DEFAULT 0,
                TaskId CHAR(36) NULL,
                INDEX IX_MeetingActionItems_MeetingId (MeetingId)
            );");
    }
#endif

app.Run();
