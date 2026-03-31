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

    // ═══ STATS / DASHBOARD ═════════════════════════════════════════════════

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var goal = await Q("SELECT * FROM ScreenTimeGoals WHERE UserId=@uid AND Status='active' LIMIT 1", Ps("@uid", Uid), ct);
        var todayLog = await Q("SELECT * FROM ScreenTimeLogs WHERE UserId=@uid AND Date=CURDATE() LIMIT 1", Ps("@uid", Uid), ct);
        var last7 = await Q("SELECT Date, ActualMinutes, TargetMinutes FROM ScreenTimeLogs WHERE UserId=@uid AND Date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY Date", Ps("@uid", Uid), ct);
        var streak = await Q(@"SELECT COUNT(*) as c FROM (
            SELECT Date, ActualMinutes, TargetMinutes FROM ScreenTimeLogs WHERE UserId=@uid AND Date <= CURDATE() ORDER BY Date DESC LIMIT 30
        ) t WHERE ActualMinutes <= TargetMinutes", Ps("@uid", Uid), ct);
        var triggers = await Q("SELECT COUNT(*) as c FROM PhoneTriggers WHERE UserId=@uid", Ps("@uid", Uid), ct);
        var zones = await Q("SELECT COUNT(*) as c FROM PhoneFreeZones WHERE UserId=@uid AND IsActive=1", Ps("@uid", Uid), ct);

        return Ok(new
        {
            goal = goal.Count > 0 ? goal[0] : null,
            todayLog = todayLog.Count > 0 ? todayLog[0] : null,
            last7Days = last7,
            streakDays = Convert.ToInt32(streak[0]["c"] ?? 0),
            triggerCount = Convert.ToInt32(triggers[0]["c"] ?? 0),
            activeZones = Convert.ToInt32(zones[0]["c"] ?? 0),
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
