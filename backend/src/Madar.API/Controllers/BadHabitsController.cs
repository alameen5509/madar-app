using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/bad-habits")]
public class BadHabitsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public BadHabitsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await Q(@"SELECT h.*,
            (SELECT COUNT(*) FROM ""BadHabitLogs"" l WHERE l.""HabitId""=h.""Id"" AND l.""Status""='clean') as ""CleanDays"",
            (SELECT COUNT(*) FROM ""BadHabitLogs"" l WHERE l.""HabitId""=h.""Id"" AND l.""Status""='urge_resisted') as ""ResistedDays"",
            (SELECT ""Status"" FROM ""BadHabitLogs"" l WHERE l.""HabitId""=h.""Id"" AND l.""LogDate""=CURDATE() LIMIT 1) as ""TodayStatus""
            FROM ""BadHabits"" h WHERE h.""UserId""::text=@uid ORDER BY h.""Status""='active' DESC, h.""CurrentStreak"" DESC",
            Ps("@uid", Uid), ct);
        return Ok(rows);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(string id, CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM \"BadHabits\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (rows.Count == 0) return NotFound();
        rows[0]["logs"] = await Q("SELECT * FROM \"BadHabitLogs\" WHERE \"HabitId\"=@hid ORDER BY \"LogDate\" DESC LIMIT 30", Ps("@hid",id), ct);
        rows[0]["strategies"] = await Q("SELECT * FROM \"BadHabitStrategies\" WHERE \"HabitId\"=@hid ORDER BY \"IsActive\" DESC", Ps("@hid",id), ct);
        return Ok(rows[0]);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BadHabitReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO ""BadHabits"" (""Id"",""UserId"",""Name"",""Category"",""TriggerText"",""Reward"",""Replacement"",""Motivation"",""IslamicContext"",""RelapsePlan"",""StartDate"",""TargetDays"")
            VALUES(@id,@uid,@n,@cat,@tr,@rw,@rep,@mot,@isl,@rp,CURDATE(),@td)",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name),P("@cat",req.Category??"سلوكية"),
             P("@tr",req.Trigger),P("@rw",req.Reward),P("@rep",req.Replacement),
             P("@mot",req.Motivation),P("@isl",req.IslamicContext),P("@rp",req.RelapsePlan),
             P("@td",req.TargetDays??66)], ct);
        // Add strategies
        if (req.Strategies != null)
            foreach (var s in req.Strategies)
                await E(@"INSERT INTO ""BadHabitStrategies"" (""Id"",""HabitId"",""Strategy"",""StrategyType"") VALUES(@id,@hid,@s,@t)",
                    [P("@id",NewId()),P("@hid",id),P("@s",s.Strategy??""),P("@t",s.Type??"replacement")], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await E("DELETE FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id", Ps("@id",id), ct);
        await E("DELETE FROM \"BadHabitStrategies\" WHERE \"HabitId\"=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM \"BadHabits\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    [HttpPost("{id}/log")]
    public async Task<IActionResult> LogDay(string id, [FromBody] LogReq req, CancellationToken ct)
    {
        var status = req.Status ?? "clean";
        await E(@"INSERT INTO ""BadHabitLogs"" (""Id"",""HabitId"",""LogDate"",""Status"",""TriggerOccurred"",""ReplacementUsed"",""UrgeLevel"",""Notes"")
            VALUES(@id,@hid,CURDATE(),@s,@to,@ru,@ul,@n)
            ON DUPLICATE KEY UPDATE ""Status""=VALUES(""Status""),""TriggerOccurred""=VALUES(""TriggerOccurred""),""ReplacementUsed""=VALUES(""ReplacementUsed""),""UrgeLevel""=VALUES(""UrgeLevel""),""Notes""=VALUES(""Notes"")",
            [P("@id",NewId()),P("@hid",id),P("@s",status),P("@to",req.TriggerOccurred??false),
             P("@ru",req.ReplacementUsed??false),P("@ul",req.UrgeLevel??0),P("@n",req.Notes)], ct);

        if (status == "clean" || status == "urge_resisted")
        {
            await E("UPDATE \"BadHabits\" SET \"CurrentStreak\"=\"CurrentStreak\"+1, \"LongestStreak\"=GREATEST(\"LongestStreak\",\"CurrentStreak\"+1) WHERE \"Id\"=@id", Ps("@id",id), ct);
        }
        else if (status == "relapsed")
        {
            await E("UPDATE \"BadHabits\" SET \"CurrentStreak\"=0, \"RelapseCount\"=\"RelapseCount\"+1 WHERE \"Id\"=@id", Ps("@id",id), ct);
        }
        return Ok(new { id, status });
    }

    [HttpPost("{id}/relapse")]
    public async Task<IActionResult> Relapse(string id, [FromBody] LogReq? req, CancellationToken ct)
    {
        await E(@"INSERT INTO ""BadHabitLogs"" (""Id"",""HabitId"",""LogDate"",""Status"",""UrgeLevel"",""Notes"") VALUES(@id,@hid,CURDATE(),'relapsed',@ul,@n)
            ON DUPLICATE KEY UPDATE ""Status""='relapsed',""UrgeLevel""=VALUES(""UrgeLevel""),""Notes""=VALUES(""Notes"")",
            [P("@id",NewId()),P("@hid",id),P("@ul",req?.UrgeLevel??5),P("@n",req?.Notes)], ct);
        await E("UPDATE \"BadHabits\" SET \"CurrentStreak\"=0, \"RelapseCount\"=\"RelapseCount\"+1 WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct);
        return Ok(new { id, status = "relapsed" });
    }

    [HttpPost("{id}/urge-resisted")]
    public async Task<IActionResult> UrgeResisted(string id, [FromBody] LogReq? req, CancellationToken ct)
    {
        await E(@"INSERT INTO ""BadHabitLogs"" (""Id"",""HabitId"",""LogDate"",""Status"",""ReplacementUsed"",""UrgeLevel"",""Notes"") VALUES(@id,@hid,CURDATE(),'urge_resisted',@ru,@ul,@n)
            ON DUPLICATE KEY UPDATE ""Status""='urge_resisted',""ReplacementUsed""=VALUES(""ReplacementUsed""),""UrgeLevel""=VALUES(""UrgeLevel""),""Notes""=VALUES(""Notes"")",
            [P("@id",NewId()),P("@hid",id),P("@ru",req?.ReplacementUsed??true),P("@ul",req?.UrgeLevel??5),P("@n",req?.Notes)], ct);
        await E("UPDATE \"BadHabits\" SET \"CurrentStreak\"=\"CurrentStreak\"+1, \"LongestStreak\"=GREATEST(\"LongestStreak\",\"CurrentStreak\"+1) WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct);
        return Ok(new { id, status = "urge_resisted" });
    }

    [HttpGet("{id}/stats")]
    public async Task<IActionResult> GetStats(string id, CancellationToken ct)
    {
        var habit = await Q("SELECT * FROM \"BadHabits\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (habit.Count == 0) return NotFound();
        var clean = await Q("SELECT COUNT(*) as c FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"Status\"='clean'", Ps("@id",id), ct);
        var resisted = await Q("SELECT COUNT(*) as c FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"Status\"='urge_resisted'", Ps("@id",id), ct);
        var relapsed = await Q("SELECT COUNT(*) as c FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"Status\"='relapsed'", Ps("@id",id), ct);
        var triggerDays = await Q("SELECT COUNT(*) as c FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"TriggerOccurred\"=1", Ps("@id",id), ct);
        var replacementUsed = await Q("SELECT COUNT(*) as c FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"ReplacementUsed\"=1", Ps("@id",id), ct);
        var avgUrge = await Q("SELECT AVG(\"UrgeLevel\") as avg FROM \"BadHabitLogs\" WHERE \"HabitId\"=@id AND \"UrgeLevel\">0", Ps("@id",id), ct);
        return Ok(new {
            cleanDays = Convert.ToInt32(clean[0]["c"]??0), resistedDays = Convert.ToInt32(resisted[0]["c"]??0),
            relapsedDays = Convert.ToInt32(relapsed[0]["c"]??0), triggerDays = Convert.ToInt32(triggerDays[0]["c"]??0),
            replacementUsedDays = Convert.ToInt32(replacementUsed[0]["c"]??0),
            avgUrgeLevel = avgUrge[0]["avg"] != null ? Math.Round(Convert.ToDouble(avgUrge[0]["avg"]),1) : 0,
            currentStreak = Convert.ToInt32(habit[0]["currentStreak"]??0), longestStreak = Convert.ToInt32(habit[0]["longestStreak"]??0),
        });
    }

    [HttpPost("{id}/strategies")]
    public async Task<IActionResult> AddStrategy(string id, [FromBody] StrategyReq req, CancellationToken ct)
    {
        var sid = NewId();
        await E(@"INSERT INTO ""BadHabitStrategies"" (""Id"",""HabitId"",""Strategy"",""StrategyType"") VALUES(@id,@hid,@s,@t)",
            [P("@id",sid),P("@hid",id),P("@s",req.Strategy??""),P("@t",req.Type??"replacement")], ct);
        return Ok(new { id = sid });
    }

    [HttpDelete("strategies/{id}")]
    public async Task<IActionResult> DeleteStrategy(string id, CancellationToken ct) =>
        (await E("DELETE FROM \"BadHabitStrategies\" WHERE \"Id\"=@id", Ps("@id",id), ct)) > 0 ? NoContent() : NotFound();

    static string NewId() => Guid.NewGuid().ToString();
    static NpgsqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<NpgsqlParameter> Ps(string n, object? v) => [P(n, v)];
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var c = _db.Database.GetDbConnection(); var w = c.State==System.Data.ConnectionState.Open; if(!w) await c.OpenAsync(ct);
      try { using var cmd=c.CreateCommand(); cmd.CommandText=sql; foreach(var p in ps) cmd.Parameters.Add(p);
          using var r=await cmd.ExecuteReaderAsync(ct); var rows=new List<Dictionary<string,object?>>();
          while(await r.ReadAsync(ct)){var row=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)row[char.ToLowerInvariant(r.GetName(i)[0])+r.GetName(i)[1..]]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(row);}return rows;
      } finally { if(!w) await c.CloseAsync(); } }
    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var c = _db.Database.GetDbConnection(); var w = c.State==System.Data.ConnectionState.Open; if(!w) await c.OpenAsync(ct);
      try { using var cmd=c.CreateCommand(); cmd.CommandText=sql; foreach(var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
      } finally { if(!w) await c.CloseAsync(); } }
}

public class BadHabitReq { public string? Name{get;set;} public string? Category{get;set;} public string? Trigger{get;set;} public string? Reward{get;set;} public string? Replacement{get;set;} public string? Motivation{get;set;} public string? IslamicContext{get;set;} public string? RelapsePlan{get;set;} public int? TargetDays{get;set;} public List<StrategyReq>? Strategies{get;set;} }
public class LogReq { public string? Status{get;set;} public bool? TriggerOccurred{get;set;} public bool? ReplacementUsed{get;set;} public int? UrgeLevel{get;set;} public string? Notes{get;set;} }
public class StrategyReq { public string? Strategy{get;set;} public string? Type{get;set;} }
