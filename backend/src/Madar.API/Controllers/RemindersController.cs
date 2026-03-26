using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/reminders")]
public class RemindersController : ControllerBase
{
    private readonly MadarDbContext _db;
    public RemindersController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// <summary>Get due reminders for today</summary>
    [HttpGet("due")]
    public async Task<IActionResult> GetDueReminders(CancellationToken ct)
    {
        var rows = await Q(@"SELECT t.Id, t.Title, t.Description, t.Status,
            t.ReminderFrequency, t.ReminderIntervalDays, t.NextReminderAt, t.LastRemindedAt,
            t.SnoozedUntil, t.ReminderStatus, t.AssignedPersonName, t.AssignedPersonRelation
            FROM SmartTasks t
            WHERE t.OwnerId=@uid
            AND t.ReminderFrequency IS NOT NULL AND t.ReminderFrequency != 'none'
            AND t.ReminderStatus = 'active'
            AND (t.SnoozedUntil IS NULL OR t.SnoozedUntil <= NOW())
            AND (t.NextReminderAt IS NULL OR t.NextReminderAt <= NOW())
            AND t.Status NOT IN (4, 6)
            ORDER BY t.NextReminderAt",
            Ps("@uid", Uid), ct);
        return Ok(rows);
    }

    /// <summary>Get all tasks with reminders</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await Q(@"SELECT t.Id, t.Title, t.Description, t.Status,
            t.ReminderFrequency, t.ReminderIntervalDays, t.NextReminderAt, t.LastRemindedAt,
            t.SnoozedUntil, t.ReminderStatus, t.AssignedPersonName, t.AssignedPersonRelation,
            t.ReminderStartDate,
            (SELECT COUNT(*) FROM ReminderLogs rl WHERE rl.TaskId=t.Id) as LogCount
            FROM SmartTasks t
            WHERE t.OwnerId=@uid AND t.ReminderFrequency IS NOT NULL AND t.ReminderFrequency != 'none'
            ORDER BY t.NextReminderAt",
            Ps("@uid", Uid), ct);
        // Add recent logs for each task
        foreach (var r in rows)
        {
            var tid = r["id"]?.ToString() ?? "";
            r["recentLogs"] = await Q("SELECT RemindedAt, Notes FROM ReminderLogs WHERE TaskId=@tid ORDER BY RemindedAt DESC LIMIT 10",
                Ps("@tid", tid), ct);
        }
        return Ok(rows);
    }

    /// <summary>Set reminder on a task</summary>
    [HttpPatch("{taskId}/set")]
    public async Task<IActionResult> SetReminder(string taskId, [FromBody] SetReminderReq req, CancellationToken ct)
    {
        var nextAt = CalculateNextReminder(req.Frequency ?? "none", req.IntervalDays, req.StartDate);
        var rows = await E(@"UPDATE SmartTasks SET
            ReminderFrequency=@f, ReminderIntervalDays=@i, ReminderStartDate=@sd,
            NextReminderAt=@na, ReminderStatus='active',
            AssignedPersonName=@pn, AssignedPersonRelation=@pr
            WHERE Id=@id AND OwnerId=@uid",
            [P("@id",taskId),P("@uid",Uid),P("@f",req.Frequency??"none"),
             P("@i",req.IntervalDays),P("@sd",req.StartDate),P("@na",nextAt),
             P("@pn",req.PersonName),P("@pr",req.PersonRelation)], ct);
        return rows > 0 ? Ok(new { taskId, nextReminderAt = nextAt }) : NotFound();
    }

    /// <summary>Mark task as reminded — advances to next cycle</summary>
    [HttpPost("{taskId}/done")]
    public async Task<IActionResult> MarkReminded(string taskId, [FromBody] MarkRemindedReq? req, CancellationToken ct)
    {
        // Get current task reminder info
        var tasks = await Q("SELECT ReminderFrequency, ReminderIntervalDays, AssignedPersonName FROM SmartTasks WHERE Id=@id AND OwnerId=@uid",
            [P("@id",taskId),P("@uid",Uid)], ct);
        if (tasks.Count == 0) return NotFound();

        var freq = tasks[0]["reminderFrequency"]?.ToString() ?? "none";
        var interval = tasks[0]["reminderIntervalDays"] != null ? Convert.ToInt32(tasks[0]["reminderIntervalDays"]) : (int?)null;
        var personName = tasks[0]["assignedPersonName"]?.ToString();

        // Log the reminder
        await E("INSERT INTO ReminderLogs (Id,TaskId,PersonName,Notes,UserId) VALUES(@id,@tid,@pn,@n,@uid)",
            [P("@id",Guid.NewGuid().ToString()),P("@tid",taskId),P("@pn",personName),P("@n",req?.Notes),P("@uid",Uid)], ct);

        // Calculate next reminder
        var nextAt = CalculateNextReminder(freq, interval, null);

        await E("UPDATE SmartTasks SET LastRemindedAt=NOW(), NextReminderAt=@na, SnoozedUntil=NULL WHERE Id=@id AND OwnerId=@uid",
            [P("@id",taskId),P("@uid",Uid),P("@na",nextAt)], ct);

        return Ok(new { taskId, nextReminderAt = nextAt });
    }

    /// <summary>Snooze a reminder</summary>
    [HttpPost("{taskId}/snooze")]
    public async Task<IActionResult> Snooze(string taskId, [FromBody] SnoozeReq req, CancellationToken ct)
    {
        var until = DateTime.UtcNow.AddHours(req.Hours ?? 1);
        var rows = await E("UPDATE SmartTasks SET SnoozedUntil=@u WHERE Id=@id AND OwnerId=@uid",
            [P("@id",taskId),P("@uid",Uid),P("@u",until)], ct);
        return rows > 0 ? Ok(new { taskId, snoozedUntil = until }) : NotFound();
    }

    /// <summary>Remove reminder from task</summary>
    [HttpDelete("{taskId}")]
    public async Task<IActionResult> RemoveReminder(string taskId, CancellationToken ct)
    {
        var rows = await E(@"UPDATE SmartTasks SET ReminderFrequency='none', ReminderIntervalDays=NULL,
            ReminderStartDate=NULL, NextReminderAt=NULL, LastRemindedAt=NULL, SnoozedUntil=NULL,
            ReminderStatus='active', AssignedPersonName=NULL, AssignedPersonRelation=NULL
            WHERE Id=@id AND OwnerId=@uid",
            [P("@id",taskId),P("@uid",Uid)], ct);
        return rows > 0 ? Ok(new { taskId }) : NotFound();
    }

    /// <summary>Get reminder history for a task</summary>
    [HttpGet("{taskId}/logs")]
    public async Task<IActionResult> GetLogs(string taskId, CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM ReminderLogs WHERE TaskId=@tid AND UserId=@uid ORDER BY RemindedAt DESC LIMIT 50",
            [P("@tid",taskId),P("@uid",Uid)], ct);
        return Ok(rows);
    }

    // ── Helpers ──

    private static DateTime? CalculateNextReminder(string freq, int? intervalDays, DateTime? startDate)
    {
        var baseDate = startDate ?? DateTime.UtcNow;
        return freq switch
        {
            "daily" => baseDate.Date.AddDays(1),
            "weekly" => baseDate.Date.AddDays(7),
            "monthly" => baseDate.Date.AddMonths(1),
            "custom" => intervalDays.HasValue ? baseDate.Date.AddDays(intervalDays.Value) : baseDate.Date.AddDays(1),
            _ => null
        };
    }

    static MySqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<MySqlParameter> Ps(string n, object? v) => [P(n, v)];

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) { var row = new Dictionary<string, object?>(); for (int i = 0; i < r.FieldCount; i++) row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i); rows.Add(row); } return rows;
        } finally { if (!w) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!w) await conn.CloseAsync(); }
    }
}

public class SetReminderReq { public string? Frequency{get;set;} public int? IntervalDays{get;set;} public DateTime? StartDate{get;set;} public string? PersonName{get;set;} public string? PersonRelation{get;set;} }
public class MarkRemindedReq { public string? Notes{get;set;} }
public class SnoozeReq { public int? Hours{get;set;} }
