using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize]
public class UsersController : BaseController
{
    private readonly MadarDbContext _db;
    public UsersController(MadarDbContext db) => _db = db;

    /// <summary>قائمة كل المستخدمين المسجلين (للمشرف)</summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var users = await _db.Users
            .OrderByDescending(u => u.LastLoginAt)
            .Select(u => new
            {
                id          = u.Id,
                fullName    = u.FullName,
                email       = u.Email,
                avatarUrl   = u.AvatarUrl,
                isActive    = u.IsActive,
                lastLoginAt = u.LastLoginAt,
                createdAt   = u.CreatedAt,
            })
            .ToListAsync(ct);

        return Ok(users);
    }

    /// <summary>مهام مستخدم محدد (للمتابعة)</summary>
    [HttpGet("{userId:guid}/tasks")]
    public async Task<IActionResult> GetUserTasks(Guid userId, CancellationToken ct)
    {
        var tasks = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .Where(t => t.OwnerId == userId)
            .OrderByDescending(t => t.UserPriority)
            .ThenBy(t => t.CreatedAt)
            .Select(t => new
            {
                id              = t.Id,
                title           = t.Title,
                status          = t.Status.ToString(),
                userPriority    = t.UserPriority,
                dueDate         = t.DueDate,
                completedAt     = t.CompletedAt,
                actualDuration  = t.ActualDurationMinutes,
                wasOnTime       = t.WasCompletedOnTime,
                contextNote     = t.ContextNote,
                lifeCircle      = t.LifeCircle == null ? null : new
                {
                    id   = t.LifeCircle.Id,
                    name = t.LifeCircle.Name,
                }
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }

    /// <summary>أهداف مستخدم محدد</summary>
    [HttpGet("{userId:guid}/goals")]
    public async Task<IActionResult> GetUserGoals(Guid userId, CancellationToken ct)
    {
        var goals = await _db.Goals
            .Include(g => g.LinkedTasks)
            .Where(g => g.OwnerId == userId)
            .OrderByDescending(g => g.TargetDate)
            .Select(g => new
            {
                id              = g.Id,
                title           = g.Title,
                status          = g.Status.ToString(),
                progressPercent = g.LinkedTasks.Count == 0 ? 0
                    : (int)Math.Round(100.0 * g.LinkedTasks.Count(t => t.Status == Domain.Enums.TaskStatus.Completed) / g.LinkedTasks.Count),
            })
            .ToListAsync(ct);

        return Ok(goals);
    }

    /// <summary>عادات مستخدم محدد</summary>
    [HttpGet("{userId:guid}/habits")]
    public async Task<IActionResult> GetUserHabits(Guid userId, CancellationToken ct)
    {
        var habits = await _db.Habits
            .Where(h => h.OwnerId == userId)
            .OrderBy(h => h.Title)
            .Select(h => new
            {
                h.Id, h.Title, h.Icon, h.Category,
                h.IsIdea, h.Streak, h.LastCompletedDate,
                todayDone = h.LastCompletedDate != null &&
                    h.LastCompletedDate.Value.Date == DateTime.UtcNow.Date,
            })
            .ToListAsync(ct);

        return Ok(habits);
    }

    /// <summary>أدوار حياة مستخدم محدد</summary>
    [HttpGet("{userId:guid}/circles")]
    public async Task<IActionResult> GetUserCircles(Guid userId, CancellationToken ct)
    {
        var circles = await _db.LifeCircles
            .Include(c => c.Goals).ThenInclude(g => g.LinkedTasks)
            .Where(c => c.OwnerId == userId)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new
            {
                c.Id, c.Name, color = c.ColorHex, tier = c.Tier.ToString(), c.DisplayOrder,
                totalGoals = c.Goals.Count,
                completedGoals = c.Goals.Count(g => g.LinkedTasks.Count > 0 && g.LinkedTasks.All(t => t.Status == Domain.Enums.TaskStatus.Completed)),
                totalTasks = c.Goals.SelectMany(g => g.LinkedTasks).Count(),
                completedTasks = c.Goals.SelectMany(g => g.LinkedTasks).Count(t => t.Status == Domain.Enums.TaskStatus.Completed),
            })
            .ToListAsync(ct);

        return Ok(circles);
    }

    /// <summary>تعديل بيانات مستخدم</summary>
    [HttpPatch("{userId:guid}")]
    public async Task<IActionResult> UpdateUser(
        Guid userId,
        [FromBody] UpdateUserRequest req,
        CancellationToken ct)
    {
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();

        if (req.FullName is not null) user.FullName = req.FullName;
        if (req.IsActive is not null) user.IsActive = req.IsActive.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(new { user.Id, user.FullName, user.Email, user.IsActive });
    }

    /// <summary>حذف مستخدم (للمشرف فقط)</summary>
    [HttpDelete("{userId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(Guid userId, CancellationToken ct)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (userId == currentUserId) return BadRequest(new { error = "لا يمكنك حذف حسابك" });

        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();

        // حذف بيانات المستخدم المرتبطة
        var tasks = _db.SmartTasks.Where(t => t.OwnerId == userId);
        var habits = _db.Habits.Where(h => h.OwnerId == userId);
        var goals = _db.Goals.Where(g => g.OwnerId == userId);
        var circles = _db.LifeCircles.Where(c => c.OwnerId == userId);

        _db.SmartTasks.RemoveRange(tasks);
        _db.Habits.RemoveRange(habits);
        _db.Goals.RemoveRange(goals);
        _db.LifeCircles.RemoveRange(circles);
        _db.Users.Remove(user);

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = $"تم حذف حساب {user.FullName}" });
    }

    /// <summary>نوع المستخدم: owner أو web-employee.
    /// عضو الفريق (WebProjectTeams) أو عضو مشروع (WebProjectMembers) يُعتبر دائماً web-employee
    /// حتى لو كان لديه Works خاصة، ليرى فقط واجهة "إدارة المواقع".</summary>
    [HttpGet("me/type")]
    public async Task<IActionResult> GetUserType(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();
        var emailLower = (user.Email ?? "").Trim().ToLowerInvariant();

        // Team / member membership takes precedence over Works ownership.
        try {
            var conn = _db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT
                (SELECT COUNT(*) FROM WebProjectTeams
                   WHERE UserId=@uid OR (@e <> '' AND LOWER(TRIM(Email))=@e))
              + (SELECT COUNT(*) FROM WebProjectMembers
                   WHERE UserId=@uid OR (@e <> '' AND LOWER(TRIM(Email))=@e))";
            var pUid = cmd.CreateParameter(); pUid.ParameterName = "@uid"; pUid.Value = userId.ToString(); cmd.Parameters.Add(pUid);
            var p = cmd.CreateParameter(); p.ParameterName = "@e"; p.Value = emailLower; cmd.Parameters.Add(p);
            var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
            if (count > 0) return Ok(new { type = "web-employee" });
        } catch {}

        // Not a team member → treat as owner.
        return Ok(new { type = "owner" });
    }

    /// <summary>جلب إعدادات المستخدم الحالي</summary>
    [HttpGet("me/preferences")]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();
        if (string.IsNullOrEmpty(user.PreferencesJson)) return Ok(new { });
        return Content(user.PreferencesJson, "application/json");
    }

    /// <summary>Key-Value store per user — syncs habits, hygiene, etc.</summary>
    [HttpGet("me/kv/{key}")]
    public async Task<IActionResult> GetKV(string key, CancellationToken ct)
    {
        var uid = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        try { _db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS \"UserKV\" (\"UserId\" VARCHAR(36) NOT NULL, \"Key\" VARCHAR(100) NOT NULL, \"Value\" TEXT, \"UpdatedAt\" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (\"UserId\", \"Key\"))"); } catch {}
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT \"Value\" FROM \"UserKV\" WHERE \"UserId\"=@uid AND \"Key\"=@k LIMIT 1";
            cmd.Parameters.Add(new NpgsqlParameter("@uid", uid));
            cmd.Parameters.Add(new NpgsqlParameter("@k", key));
            var result = await cmd.ExecuteScalarAsync(ct);
            return Ok(new { value = result?.ToString() });
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    [HttpPut("me/kv/{key}")]
    public async Task<IActionResult> SetKV(string key, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var uid = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var value = body.TryGetProperty("value", out var v) ? v.GetString() : body.GetRawText();
        try { _db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS \"UserKV\" (\"UserId\" VARCHAR(36) NOT NULL, \"Key\" VARCHAR(100) NOT NULL, \"Value\" TEXT, \"UpdatedAt\" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (\"UserId\", \"Key\"))"); } catch {}
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "INSERT INTO \"UserKV\" (\"UserId\", \"Key\", \"Value\", \"UpdatedAt\") VALUES(@uid, @k, @v, NOW()) ON CONFLICT (\"UserId\", \"Key\") DO UPDATE SET \"Value\"=EXCLUDED.\"Value\", \"UpdatedAt\"=NOW()";
            cmd.Parameters.Add(new NpgsqlParameter("@uid", uid));
            cmd.Parameters.Add(new NpgsqlParameter("@k", key));
            cmd.Parameters.Add(new NpgsqlParameter("@v", value));
            await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!wasOpen) await conn.CloseAsync(); }
        return Ok(new { success = true });
    }

    /// <summary>حفظ إعدادات المستخدم الحالي</summary>
    [HttpPut("me/preferences")]
    public async Task<IActionResult> SavePreferences([FromBody] System.Text.Json.JsonElement prefs, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();
        user.PreferencesJson = prefs.GetRawText();
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم حفظ الإعدادات" });
    }
}

public record UpdateUserRequest(
    string? FullName = null,
    bool? IsActive = null
);
