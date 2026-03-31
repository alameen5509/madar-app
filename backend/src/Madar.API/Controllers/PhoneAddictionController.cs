using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/phone-addiction")]
public class PhoneAddictionController : ControllerBase
{
    private readonly MadarDbContext _db;
    public PhoneAddictionController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ═══ GOAL ══════════════════════════════════════════════════════════════

    [HttpGet("goal")]
    public async Task<IActionResult> GetGoal(CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM ScreenTimeGoals WHERE UserId=@uid AND Status='active' ORDER BY CreatedAt DESC LIMIT 1", Ps("@uid", Uid), ct);
        return Ok(rows.Count > 0 ? rows[0] : null);
    }

    [HttpPost("goal")]
    public async Task<IActionResult> CreateGoal([FromBody] GoalReq req, CancellationToken ct)
    {
        // Deactivate any existing active goal
        await E("UPDATE ScreenTimeGoals SET Status='replaced' WHERE UserId=@uid AND Status='active'", Ps("@uid", Uid), ct);
        var id = NewId();
        await E(@"INSERT INTO ScreenTimeGoals (Id,UserId,CurrentDailyHours,TargetDailyHours,WeeklyReductionMinutes,WhyMotivation,StartDate,TargetDate,Status)
            VALUES(@id,@uid,@cur,@tgt,@red,@why,NOW(),@td,'active')",
            [P("@id",id),P("@uid",Uid),P("@cur",req.CurrentDailyHours),P("@tgt",req.TargetDailyHours),
             P("@red",req.WeeklyReductionMinutes??15),P("@why",req.WhyMotivation),P("@td",req.TargetDate)], ct);
        return Ok(new { id });
    }

    [HttpPatch("goal/{id}")]
    public async Task<IActionResult> UpdateGoal(string id, [FromBody] GoalReq req, CancellationToken ct)
    {
        await E(@"UPDATE ScreenTimeGoals SET
            CurrentDailyHours=COALESCE(@cur,CurrentDailyHours),
            TargetDailyHours=COALESCE(@tgt,TargetDailyHours),
            WeeklyReductionMinutes=COALESCE(@red,WeeklyReductionMinutes),
            WhyMotivation=COALESCE(@why,WhyMotivation),
            Status=COALESCE(@st,Status)
            WHERE Id=@id AND UserId=@uid",
            [P("@id",id),P("@uid",Uid),P("@cur",req.CurrentDailyHours),P("@tgt",req.TargetDailyHours),
             P("@red",req.WeeklyReductionMinutes),P("@why",req.WhyMotivation),P("@st",req.Status)], ct);
        return Ok(new { id });
    }

    // ═══ DAILY LOGS ════════════════════════════════════════════════════════

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs([FromQuery] int days = 30, CancellationToken ct = default)
    {
        var rows = await Q("SELECT * FROM ScreenTimeLogs WHERE UserId=@uid AND Date >= DATE_SUB(CURDATE(), INTERVAL @d DAY) ORDER BY Date DESC",
            [P("@uid", Uid), P("@d", days)], ct);
        return Ok(rows);
    }

    [HttpPost("logs")]
    public async Task<IActionResult> LogDay([FromBody] ScreenTimeLogReq req, CancellationToken ct)
    {
        var id = NewId();
        // Upsert: delete existing for same date, then insert
        await E("DELETE FROM ScreenTimeLogs WHERE UserId=@uid AND Date=@dt", [P("@uid",Uid),P("@dt",req.Date)], ct);
        await E(@"INSERT INTO ScreenTimeLogs (Id,UserId,Date,ActualMinutes,TargetMinutes,Mood,TopApps,Note)
            VALUES(@id,@uid,@dt,@am,@tm,@mood,@apps,@note)",
            [P("@id",id),P("@uid",Uid),P("@dt",req.Date),P("@am",req.ActualMinutes),P("@tm",req.TargetMinutes),
             P("@mood",req.Mood),P("@apps",req.TopApps),P("@note",req.Note)], ct);
        return Ok(new { id });
    }

    // ═══ TRIGGERS ══════════════════════════════════════════════════════════

    [HttpGet("triggers")]
    public async Task<IActionResult> GetTriggers(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM PhoneTriggers WHERE UserId=@uid ORDER BY Frequency DESC", Ps("@uid", Uid), ct));

    [HttpPost("triggers")]
    public async Task<IActionResult> AddTrigger([FromBody] TriggerReq req, CancellationToken ct)
    {
        var id = NewId();
        await E("INSERT INTO PhoneTriggers (Id,UserId,TriggerName,Category,Alternative,Frequency) VALUES(@id,@uid,@n,@c,@a,@f)",
            [P("@id",id),P("@uid",Uid),P("@n",req.TriggerName),P("@c",req.Category),P("@a",req.Alternative),P("@f",req.Frequency??1)], ct);
        return Ok(new { id });
    }

    [HttpPatch("triggers/{id}")]
    public async Task<IActionResult> UpdateTrigger(string id, [FromBody] TriggerReq req, CancellationToken ct)
    {
        await E(@"UPDATE PhoneTriggers SET TriggerName=COALESCE(@n,TriggerName),Category=COALESCE(@c,Category),
            Alternative=COALESCE(@a,Alternative),Frequency=COALESCE(@f,Frequency) WHERE Id=@id AND UserId=@uid",
            [P("@id",id),P("@uid",Uid),P("@n",req.TriggerName),P("@c",req.Category),P("@a",req.Alternative),P("@f",req.Frequency)], ct);
        return Ok(new { id });
    }

    [HttpDelete("triggers/{id}")]
    public async Task<IActionResult> DeleteTrigger(string id, CancellationToken ct) =>
        (await E("DELETE FROM PhoneTriggers WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();

    // ═══ PHONE-FREE ZONES ══════════════════════════════════════════════════

    [HttpGet("free-zones")]
    public async Task<IActionResult> GetFreeZones(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM PhoneFreeZones WHERE UserId=@uid ORDER BY StartTime", Ps("@uid", Uid), ct));

    [HttpPost("free-zones")]
    public async Task<IActionResult> AddFreeZone([FromBody] FreeZoneReq req, CancellationToken ct)
    {
        var id = NewId();
        await E("INSERT INTO PhoneFreeZones (Id,UserId,ZoneName,StartTime,EndTime,DaysOfWeek,IsActive,StreakDays) VALUES(@id,@uid,@n,@st,@et,@dow,1,0)",
            [P("@id",id),P("@uid",Uid),P("@n",req.ZoneName),P("@st",req.StartTime),P("@et",req.EndTime),P("@dow",req.DaysOfWeek)], ct);
        return Ok(new { id });
    }

    [HttpPatch("free-zones/{id}")]
    public async Task<IActionResult> UpdateFreeZone(string id, [FromBody] FreeZoneReq req, CancellationToken ct)
    {
        await E(@"UPDATE PhoneFreeZones SET ZoneName=COALESCE(@n,ZoneName),StartTime=COALESCE(@st,StartTime),
            EndTime=COALESCE(@et,EndTime),DaysOfWeek=COALESCE(@dow,DaysOfWeek),IsActive=COALESCE(@a,IsActive)
            WHERE Id=@id AND UserId=@uid",
            [P("@id",id),P("@uid",Uid),P("@n",req.ZoneName),P("@st",req.StartTime),P("@et",req.EndTime),
             P("@dow",req.DaysOfWeek),P("@a",req.IsActive)], ct);
        return Ok(new { id });
    }

    [HttpDelete("free-zones/{id}")]
    public async Task<IActionResult> DeleteFreeZone(string id, CancellationToken ct) =>
        (await E("DELETE FROM PhoneFreeZones WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();

    // ═══ PHONE TASKS ═══════════════════════════════════════════════════════

    [HttpGet("tasks")]
    public async Task<IActionResult> GetTasks(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM PhoneTasks WHERE UserId=@uid ORDER BY CASE WHEN IsCompleted=1 THEN 1 ELSE 0 END, NextDueAt ASC, CreatedAt DESC", Ps("@uid", Uid), ct));

    [HttpGet("tasks/due")]
    public async Task<IActionResult> GetDueTasks(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM PhoneTasks WHERE UserId=@uid AND IsCompleted=0 AND (NextDueAt IS NULL OR NextDueAt <= NOW()) ORDER BY NextDueAt", Ps("@uid", Uid), ct));

    [HttpPost("tasks")]
    public async Task<IActionResult> CreateTask([FromBody] PhoneTaskReq req, CancellationToken ct)
    {
        var id = NewId();
        // Calculate next due
        var nextDue = req.RecurringType switch
        {
            "hourly" => DateTime.UtcNow.AddHours(1),
            "every3hours" => DateTime.UtcNow.AddHours(3),
            "every5hours" => DateTime.UtcNow.AddHours(5),
            "every10hours" => DateTime.UtcNow.AddHours(10),
            "daily" => DateTime.UtcNow.Date.AddDays(1),
            "custom" when req.RecurringIntervalHours > 0 => DateTime.UtcNow.AddHours(req.RecurringIntervalHours ?? 1),
            _ => DateTime.UtcNow, // none = due now
        };
        await E(@"INSERT INTO PhoneTasks (Id,UserId,Title,RecurringType,RecurringIntervalHours,NextDueAt,IsCompleted,CreatedAt)
            VALUES(@id,@uid,@t,@rt,@ri,@nd,0,NOW())",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@rt",req.RecurringType??"none"),P("@ri",req.RecurringIntervalHours),P("@nd",nextDue)], ct);
        return Ok(new { id });
    }

    [HttpPost("tasks/{id}/complete")]
    public async Task<IActionResult> CompleteTask(string id, CancellationToken ct)
    {
        var task = await Q("SELECT * FROM PhoneTasks WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (task.Count == 0) return NotFound();
        var t = task[0];
        var rt = t["recurringType"]?.ToString() ?? "none";

        if (rt == "none")
        {
            await E("UPDATE PhoneTasks SET IsCompleted=1, CompletedAt=NOW(), LastCompletedAt=NOW() WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct);
        }
        else
        {
            var nextDue = rt switch
            {
                "hourly" => DateTime.UtcNow.AddHours(1),
                "every3hours" => DateTime.UtcNow.AddHours(3),
                "every5hours" => DateTime.UtcNow.AddHours(5),
                "every10hours" => DateTime.UtcNow.AddHours(10),
                "daily" => DateTime.UtcNow.Date.AddDays(1),
                "custom" => DateTime.UtcNow.AddHours(Convert.ToInt32(t["recurringIntervalHours"] ?? 1)),
                _ => DateTime.UtcNow.AddHours(1),
            };
            await E("UPDATE PhoneTasks SET LastCompletedAt=NOW(), NextDueAt=@nd WHERE Id=@id AND UserId=@uid",
                [P("@id",id),P("@uid",Uid),P("@nd",nextDue)], ct);
        }
        return Ok(new { id });
    }

    [HttpDelete("tasks/{id}")]
    public async Task<IActionResult> DeleteTask(string id, CancellationToken ct) =>
        (await E("DELETE FROM PhoneTasks WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();

    // ═══ TREATMENT PLAN ════════════════════════════════════════════════════

    [HttpGet("plan")]
    public async Task<IActionResult> GetPlan(CancellationToken ct)
    {
        var goal = await Q("SELECT * FROM ScreenTimeGoals WHERE UserId=@uid AND Status='active' LIMIT 1", Ps("@uid", Uid), ct);
        if (goal.Count == 0) return Ok(new { weeks = Array.Empty<object>() });
        var g = goal[0];
        var curHrs = Convert.ToDecimal(g["currentDailyHours"] ?? 0);
        var tgtHrs = Convert.ToDecimal(g["targetDailyHours"] ?? 2);
        var redMin = Convert.ToInt32(g["weeklyReductionMinutes"] ?? 15);
        var startDate = g["startDate"] is DateTime sd ? sd : DateTime.UtcNow;

        var weeks = new List<object>();
        var curMin = curHrs * 60;
        var tgtMin = tgtHrs * 60;
        var weekNum = 0;
        while (curMin > tgtMin && weekNum < 52)
        {
            weekNum++;
            var weekStart = startDate.AddDays((weekNum - 1) * 7);
            var weekTarget = Math.Max(curMin - (redMin * weekNum), tgtMin);
            // Check actual logs for this week
            var logs = await Q("SELECT AVG(ActualMinutes) as avg FROM ScreenTimeLogs WHERE UserId=@uid AND Date >= @ws AND Date < @we",
                [P("@uid",Uid),P("@ws",weekStart.ToString("yyyy-MM-dd")),P("@we",weekStart.AddDays(7).ToString("yyyy-MM-dd"))], ct);
            var actualAvg = logs.Count > 0 && logs[0]["avg"] != null ? Convert.ToDecimal(logs[0]["avg"]!) : (decimal?)null;
            weeks.Add(new { week = weekNum, weekStart = weekStart.ToString("yyyy-MM-dd"), targetMinutes = Math.Round(weekTarget), actualAvgMinutes = actualAvg != null ? Math.Round(actualAvg.Value) : (decimal?)null, achieved = actualAvg != null && actualAvg <= weekTarget });
        }
        return Ok(new { weeks, currentWeek = Math.Max(1, (int)Math.Ceiling((DateTime.UtcNow - startDate).TotalDays / 7.0)) });
    }

    // ═══ STATS / DASHBOARD ═════════════════════════════════════════════════

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var goal = await Q("SELECT * FROM ScreenTimeGoals WHERE UserId=@uid AND Status='active' LIMIT 1", Ps("@uid", Uid), ct);
        var todayLog = await Q("SELECT * FROM ScreenTimeLogs WHERE UserId=@uid AND Date=CURDATE() LIMIT 1", Ps("@uid", Uid), ct);
        var yesterdayLog = await Q("SELECT * FROM ScreenTimeLogs WHERE UserId=@uid AND Date=DATE_SUB(CURDATE(), INTERVAL 1 DAY) LIMIT 1", Ps("@uid", Uid), ct);
        var last7 = await Q("SELECT Date, ActualMinutes, TargetMinutes FROM ScreenTimeLogs WHERE UserId=@uid AND Date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY Date", Ps("@uid", Uid), ct);
        var streak = await Q(@"SELECT COUNT(*) as c FROM (
            SELECT Date, ActualMinutes, TargetMinutes FROM ScreenTimeLogs WHERE UserId=@uid AND Date <= CURDATE() ORDER BY Date DESC LIMIT 30
        ) t WHERE ActualMinutes <= TargetMinutes", Ps("@uid", Uid), ct);
        var triggers = await Q("SELECT COUNT(*) as c FROM PhoneTriggers WHERE UserId=@uid", Ps("@uid", Uid), ct);
        var zones = await Q("SELECT COUNT(*) as c FROM PhoneFreeZones WHERE UserId=@uid AND IsActive=1", Ps("@uid", Uid), ct);
        var dueTasks = await Q("SELECT COUNT(*) as c FROM PhoneTasks WHERE UserId=@uid AND IsCompleted=0 AND (NextDueAt IS NULL OR NextDueAt <= NOW())", Ps("@uid", Uid), ct);

        return Ok(new
        {
            goal = goal.Count > 0 ? goal[0] : null,
            todayLog = todayLog.Count > 0 ? todayLog[0] : null,
            yesterdayLog = yesterdayLog.Count > 0 ? yesterdayLog[0] : null,
            last7Days = last7,
            streakDays = Convert.ToInt32(streak[0]["c"] ?? 0),
            triggerCount = Convert.ToInt32(triggers[0]["c"] ?? 0),
            activeZones = Convert.ToInt32(zones[0]["c"] ?? 0),
            dueTaskCount = Convert.ToInt32(dueTasks[0]["c"] ?? 0),
        });
    }

    // ═══ HELPERS ════════════════════════════════════════════════════════════
    static string NewId() => Guid.NewGuid().ToString();
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

public class GoalReq { public decimal? CurrentDailyHours{get;set;} public decimal? TargetDailyHours{get;set;} public int? WeeklyReductionMinutes{get;set;} public string? WhyMotivation{get;set;} public DateTime? TargetDate{get;set;} public string? Status{get;set;} }
public class ScreenTimeLogReq { public string Date{get;set;}=default!; public int ActualMinutes{get;set;} public int TargetMinutes{get;set;} public string? Mood{get;set;} public string? TopApps{get;set;} public string? Note{get;set;} }
public class TriggerReq { public string? TriggerName{get;set;} public string? Category{get;set;} public string? Alternative{get;set;} public int? Frequency{get;set;} }
public class FreeZoneReq { public string? ZoneName{get;set;} public string? StartTime{get;set;} public string? EndTime{get;set;} public string? DaysOfWeek{get;set;} public bool? IsActive{get;set;} }
public class PhoneTaskReq { public string Title{get;set;}=default!; public string? RecurringType{get;set;} public int? RecurringIntervalHours{get;set;} }
