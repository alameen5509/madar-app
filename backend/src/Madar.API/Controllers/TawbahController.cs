using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/tawbah")]
public class TawbahController : ControllerBase
{
    private readonly MadarDbContext _db;
    public TawbahController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await Q(@"SELECT t.*,
            (SELECT COUNT(*) FROM ""TawbahActions"" a WHERE a.""TawbahId""=t.""Id"") as ""ActionsCount"",
            (SELECT COUNT(*) FROM ""TawbahActions"" a WHERE a.""TawbahId""=t.""Id"" AND a.""IsCompleted""=1) as ""CompletedActions"",
            (SELECT COUNT(*) FROM ""TawbahReflections"" r WHERE r.""TawbahId""=t.""Id"") as ""ReflectionsCount""
            FROM ""TawbahRecords"" t WHERE t.""UserId""::text=@uid ORDER BY t.""Status""='active' DESC, t.""CreatedAt"" DESC",
            Ps("@uid", Uid), ct);
        return Ok(rows);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(string id, CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM \"TawbahRecords\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (rows.Count == 0) return NotFound();
        rows[0]["actions"] = await Q("SELECT * FROM \"TawbahActions\" WHERE \"TawbahId\"=@tid ORDER BY \"IsCompleted\", \"CompletedAt\" DESC", Ps("@tid",id), ct);
        rows[0]["reflections"] = await Q("SELECT * FROM \"TawbahReflections\" WHERE \"TawbahId\"=@tid ORDER BY \"CreatedAt\" DESC", Ps("@tid",id), ct);
        return Ok(rows[0]);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TawbahReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO ""TawbahRecords"" (""Id"",""UserId"",""Title"",""Category"",""RootCause"",""RepentanceText"",""FixPlan"",""HasPersonRight"",""PersonRightStatus"",""PersonName"",""RecurrenceCount"",""Status"")
            VALUES(@id,@uid,@t,@cat,@rc,@rt,@fp,@hpr,@prs,@pn,@cnt,'active')",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@cat",req.Category??"حق الله"),
             P("@rc",req.RootCause),P("@rt",req.RepentanceText),P("@fp",req.FixPlan),
             P("@hpr",req.HasPersonRight??false),P("@prs",req.HasPersonRight==true?"pending":null),
             P("@pn",req.PersonName),P("@cnt",req.RecurrenceCount??0)], ct);

        // Add reflections
        if (req.Reflections != null)
            foreach (var r in req.Reflections)
                await E(@"INSERT INTO ""TawbahReflections"" (""Id"",""TawbahId"",""Question"",""Answer"") VALUES(@id,@tid,@q,@a)",
                    [P("@id",NewId()),P("@tid",id),P("@q",r.Question??""),P("@a",r.Answer)], ct);

        // Add actions and optionally create tasks
        if (req.Actions != null)
            foreach (var a in req.Actions)
            {
                string? taskId = null;
                if (a.CreateTask == true && !string.IsNullOrEmpty(a.Title))
                {
                    taskId = NewId();
                    await E(@"INSERT INTO ""SmartTasks"" (""Id"",""OwnerId"",""Title"",""Description"",""Status"",""UserPriority"",""RequiredCognitiveLoad"",""Context"",""CreatedAt"",""UpdatedAt"")
                        VALUES(@tid,@uid,@t,@d,1,2,1,0,NOW(),NOW())",
                        [P("@tid",taskId),P("@uid",Uid),P("@t",a.Title),P("@d",$"عمل إصلاح — توبة: {req.Title}")], ct);
                }
                await E("INSERT INTO \"TawbahActions\" (\"Id\",\"TawbahId\",\"Title\",\"ActionType\",\"TaskId\") VALUES(@id,@tid,@t,@at,@taskId)",
                    [P("@id",NewId()),P("@tid",id),P("@t",a.Title??""),P("@at",a.ActionType??"task"),P("@taskId",taskId)], ct);
            }

        // If person right — create task for restoring
        if (req.HasPersonRight == true && !string.IsNullOrEmpty(req.PersonName))
        {
            var taskId = NewId();
            await E(@"INSERT INTO ""SmartTasks"" (""Id"",""OwnerId"",""Title"",""Description"",""Status"",""UserPriority"",""RequiredCognitiveLoad"",""Context"",""CreatedAt"",""UpdatedAt"")
                VALUES(@tid,@uid,@t,@d,1,1,1,0,NOW(),NOW())",
                [P("@tid",taskId),P("@uid",Uid),P("@t",$"رد الحق لـ {req.PersonName}"),P("@d",$"حق آدمي — توبة: {req.Title}")], ct);
        }

        return Ok(new { id, title = req.Title });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] TawbahReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""TawbahRecords"" SET ""Title""=COALESCE(@t,""Title""),""Category""=COALESCE(@cat,""Category""),
            ""RootCause""=COALESCE(@rc,""RootCause""),""RepentanceText""=COALESCE(@rt,""RepentanceText""),""FixPlan""=COALESCE(@fp,""FixPlan"")
            WHERE ""Id""::text=@id AND ""UserId""::text=@uid",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@cat",req.Category),P("@rc",req.RootCause),P("@rt",req.RepentanceText),P("@fp",req.FixPlan)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpPost("{id}/reflect")]
    public async Task<IActionResult> AddReflection(string id, [FromBody] ReflectionReq req, CancellationToken ct)
    {
        var rid = NewId();
        await E(@"INSERT INTO ""TawbahReflections"" (""Id"",""TawbahId"",""Question"",""Answer"") VALUES(@id,@tid,@q,@a)",
            [P("@id",rid),P("@tid",id),P("@q",req.Question??""),P("@a",req.Answer)], ct);
        return Ok(new { id = rid });
    }

    [HttpPost("{id}/repent")]
    public async Task<IActionResult> MarkRepented(string id, CancellationToken ct)
    {
        var rows = await E("UPDATE \"TawbahRecords\" SET \"Status\"='repented', \"RepentedAt\"=NOW() WHERE \"Id\"=@id AND \"UserId\"=@uid AND \"Status\"='active'",
            [P("@id",id),P("@uid",Uid)], ct);
        return rows > 0 ? Ok(new { id, status = "repented" }) : NotFound();
    }

    [HttpPost("{id}/relapse")]
    public async Task<IActionResult> MarkRelapsed(string id, [FromBody] RelapseReq? req, CancellationToken ct)
    {
        await E("UPDATE \"TawbahRecords\" SET \"Status\"='relapsed', \"RecurrenceCount\"=\"RecurrenceCount\"+1 WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id",id),P("@uid",Uid)], ct);
        if (!string.IsNullOrEmpty(req?.Note))
            await E(@"INSERT INTO ""TawbahReflections"" (""Id"",""TawbahId"",""Question"",""Answer"") VALUES(@id,@tid,'لماذا انتكست؟',@a)",
                [P("@id",NewId()),P("@tid",id),P("@a",req.Note)], ct);
        return Ok(new { id, status = "relapsed" });
    }

    [HttpPost("{id}/reactivate")]
    public async Task<IActionResult> Reactivate(string id, CancellationToken ct)
    {
        var rows = await E("UPDATE \"TawbahRecords\" SET \"Status\"='active' WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id",id),P("@uid",Uid)], ct);
        return rows > 0 ? Ok(new { id, status = "active" }) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await E("DELETE FROM \"TawbahActions\" WHERE \"TawbahId\"=@id", Ps("@id",id), ct);
        await E("DELETE FROM \"TawbahReflections\" WHERE \"TawbahId\"=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM \"TawbahRecords\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var total = await Q("SELECT COUNT(*) as c FROM \"TawbahRecords\" WHERE \"UserId\"=@uid", Ps("@uid",Uid), ct);
        var active = await Q("SELECT COUNT(*) as c FROM \"TawbahRecords\" WHERE \"UserId\"=@uid AND \"Status\"='active'", Ps("@uid",Uid), ct);
        var repented = await Q("SELECT COUNT(*) as c FROM \"TawbahRecords\" WHERE \"UserId\"=@uid AND \"Status\"='repented'", Ps("@uid",Uid), ct);
        var relapsed = await Q("SELECT COUNT(*) as c FROM \"TawbahRecords\" WHERE \"UserId\"=@uid AND \"Status\"='relapsed'", Ps("@uid",Uid), ct);
        var topRecurring = await Q("SELECT \"Title\", \"RecurrenceCount\" FROM \"TawbahRecords\" WHERE \"UserId\"=@uid AND \"RecurrenceCount\">0 ORDER BY \"RecurrenceCount\" DESC LIMIT 5", Ps("@uid",Uid), ct);
        return Ok(new {
            total = Convert.ToInt32(total[0]["c"]??0), active = Convert.ToInt32(active[0]["c"]??0),
            repented = Convert.ToInt32(repented[0]["c"]??0), relapsed = Convert.ToInt32(relapsed[0]["c"]??0),
            topRecurring
        });
    }

    // Helpers
    static string NewId() => Guid.NewGuid().ToString();
    static NpgsqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<NpgsqlParameter> Ps(string n, object? v) => [P(n, v)];
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
      try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
          using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<Dictionary<string, object?>>();
          while (await r.ReadAsync(ct)) { var row = new Dictionary<string, object?>(); for (int i = 0; i < r.FieldCount; i++) row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i); rows.Add(row); } return rows;
      } finally { if (!w) await conn.CloseAsync(); } }
    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
      try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
      } finally { if (!w) await conn.CloseAsync(); } }
}

public class TawbahReq { public string? Title{get;set;} public string? Category{get;set;} public string? RootCause{get;set;} public string? RepentanceText{get;set;} public string? FixPlan{get;set;} public bool? HasPersonRight{get;set;} public string? PersonName{get;set;} public int? RecurrenceCount{get;set;} public List<TawbahActionReq>? Actions{get;set;} public List<ReflectionReq>? Reflections{get;set;} }
public class TawbahActionReq { public string? Title{get;set;} public string? ActionType{get;set;} public bool? CreateTask{get;set;} }
public class ReflectionReq { public string? Question{get;set;} public string? Answer{get;set;} }
public class RelapseReq { public string? Note{get;set;} }
