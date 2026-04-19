using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/war-room")]
public class WarRoomController : ControllerBase
{
    private readonly MadarDbContext _db;
    public WarRoomController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ═══ ROLES ═══════════════════════════════════════════════════════════

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles(CancellationToken ct)
    {
        // تنظيف الأدوار اليتيمة المرتبطة بأعمال محذوفة
        var uid = Guid.Parse(Uid);
        var orphanRoles = await Q(@"SELECT ""Id"" FROM ""LeadershipRoles"" WHERE ""UserId""=@uid AND ""WorkId"" IS NOT NULL AND ""WorkId"" != '' AND ""WorkId"" NOT IN (SELECT ""Id""::text FROM ""Works"" WHERE ""OwnerId""::text=@uid2)",
            [P("@uid", Uid), P("@uid2", Uid)], ct);
        foreach (var orphan in orphanRoles)
        {
            var oid = orphan["id"]?.ToString();
            if (oid == null) continue;
            await E(@"DELETE FROM ""LeadershipNotes"" WHERE ""RoleId""=@rid", Ps("@rid", oid), ct);
            await E(@"DELETE FROM ""LeadershipDevRequests"" WHERE ""RoleId""=@rid", Ps("@rid", oid), ct);
            await E(@"DELETE FROM ""LeadershipRoles"" WHERE ""Id""=@id", Ps("@id", oid), ct);
        }

        // المناصب اليدوية
        var roles = await Q(@"SELECT r.*,
            (SELECT COUNT(*) FROM ""LeadershipNotes"" n WHERE n.""RoleId""=r.""Id"") as ""NotesCount"",
            (SELECT COUNT(*) FROM ""LeadershipDevRequests"" d WHERE d.""RoleId""=r.""Id"" AND d.""Status"" IN ('new','inReview')) as ""PendingDevCount""
            FROM ""LeadershipRoles"" r WHERE r.""UserId""=@uid AND r.""IsActive""=true ORDER BY r.""Priority"", r.""CreatedAt""",
            Ps("@uid", Uid), ct);

        // الأعمال والوظائف — تظهر تلقائياً كمناصب
        var linkedWorkIds = new HashSet<string>(
            roles.Where(r => r.ContainsKey("workId") && r["workId"] != null && r["workId"]!.ToString() != "")
                 .Select(r => r["workId"]!.ToString()!),
            StringComparer.OrdinalIgnoreCase);

        var works = await _db.Works
            .Where(w => w.OwnerId == uid)
            .Include(w => w.Jobs)
            .ToListAsync(ct);

        foreach (var w in works)
        {
            if (!linkedWorkIds.Contains(w.Id.ToString()))
            {
                roles.Add(new Dictionary<string, object?>
                {
                    ["id"] = $"auto-work-{w.Id}",
                    ["title"] = w.Name,
                    ["organization"] = w.Type == "job" ? w.Employer : w.Sector,
                    ["sector"] = w.Sector,
                    ["description"] = w.Type == "job" ? w.Title : w.Role,
                    ["pulseStatus"] = w.Status == "active" ? "green" : "yellow",
                    ["pulseNote"] = null,
                    ["nextReviewDate"] = null,
                    ["lastReviewDate"] = null,
                    ["reviewFrequency"] = "weekly",
                    ["color"] = w.Type == "job" ? "#2D6B9E" : "#5E5495",
                    ["icon"] = w.Type == "job" ? "💼" : "🏢",
                    ["priority"] = 0,
                    ["workId"] = w.Id.ToString(),
                    ["notesCount"] = 0,
                    ["pendingDevCount"] = 0,
                    ["isAuto"] = true,
                    ["autoSource"] = "work",
                });
            }

            // الوظائف التابعة (لمشاريع ريادية)
            foreach (var j in w.Jobs)
            {
                roles.Add(new Dictionary<string, object?>
                {
                    ["id"] = $"auto-job-{j.Id}",
                    ["title"] = $"{j.Title} — {w.Name}",
                    ["organization"] = w.Sector ?? w.Name,
                    ["sector"] = w.Sector,
                    ["description"] = j.Description,
                    ["pulseStatus"] = j.Status == "active" ? "green" : "yellow",
                    ["pulseNote"] = null,
                    ["nextReviewDate"] = null,
                    ["lastReviewDate"] = null,
                    ["reviewFrequency"] = "weekly",
                    ["color"] = "#D4AF37",
                    ["icon"] = "👔",
                    ["priority"] = 1,
                    ["workId"] = w.Id.ToString(),
                    ["notesCount"] = 0,
                    ["pendingDevCount"] = 0,
                    ["isAuto"] = true,
                    ["autoSource"] = "job",
                });
            }
        }

        return Ok(roles);
    }

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] RoleReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO ""LeadershipRoles"" (""Id"",""UserId"",""Title"",""Organization"",""Sector"",""Description"",""StartDate"",""WorkId"",""ReviewFrequency"",""Color"",""Icon"",""Priority"")
            VALUES(@id,@uid,@t,@org,@sec,@desc,@sd,@wid,@rf,@c,@ic,@p)",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@org",req.Organization),P("@sec",req.Sector),
             P("@desc",req.Description),P("@sd",req.StartDate),P("@wid",req.WorkId),
             P("@rf",req.ReviewFrequency??"weekly"),P("@c",req.Color??"#5E5495"),P("@ic",req.Icon??"🎯"),P("@p",req.Priority??0)], ct);
        return Ok(new { id, title = req.Title });
    }

    [HttpPut("roles/{id}")]
    public async Task<IActionResult> UpdateRole(string id, [FromBody] RoleReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""LeadershipRoles"" SET ""Title""=COALESCE(@t,""Title""),""Organization""=COALESCE(@org,""Organization""),
            ""Sector""=COALESCE(@sec,""Sector""),""Description""=COALESCE(@desc,""Description""),""Color""=COALESCE(@c,""Color""),""Icon""=COALESCE(@ic,""Icon""),
            ""Priority""=COALESCE(@p,""Priority"") WHERE ""Id""=@id AND ""UserId""=@uid",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@org",req.Organization),P("@sec",req.Sector),
             P("@desc",req.Description),P("@c",req.Color),P("@ic",req.Icon),P("@p",req.Priority)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteRole(string id, CancellationToken ct)
    {
        await E(@"DELETE FROM ""LeadershipNotes"" WHERE ""RoleId""=@id", Ps("@id",id), ct);
        await E(@"DELETE FROM ""LeadershipDevRequests"" WHERE ""RoleId""=@id", Ps("@id",id), ct);
        return (await E(@"DELETE FROM ""LeadershipRoles"" WHERE ""Id""=@id AND ""UserId""=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    // ═══ PULSE ═══════════════════════════════════════════════════════════

    [HttpPatch("roles/{id}/pulse")]
    public async Task<IActionResult> UpdatePulse(string id, [FromBody] PulseReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""LeadershipRoles"" SET ""PulseStatus""=@ps, ""PulseNote""=@pn, ""LastReviewDate""=NOW(),
            ""NextReviewDate""=CASE ""ReviewFrequency""
                WHEN 'daily' THEN NOW() + INTERVAL '1 day'
                WHEN 'weekly' THEN NOW() + INTERVAL '7 days'
                WHEN 'monthly' THEN NOW() + INTERVAL '1 month'
                ELSE NOW() + INTERVAL '7 days' END
            WHERE ""Id""=@id AND ""UserId""=@uid",
            [P("@id",id),P("@uid",Uid),P("@ps",req.Status??"green"),P("@pn",req.Note)], ct);
        return rows > 0 ? Ok(new { id, pulseStatus = req.Status }) : NotFound();
    }

    // ═══ NOTES ═══════════════════════════════════════════════════════════

    [HttpGet("roles/{roleId}/notes")]
    public async Task<IActionResult> GetNotes(string roleId, CancellationToken ct) =>
        Ok(await Q(@"SELECT * FROM ""LeadershipNotes"" WHERE ""RoleId""=@rid AND ""UserId""=@uid ORDER BY ""CreatedAt"" DESC LIMIT 50",
            [P("@rid",roleId),P("@uid",Uid)], ct));

    [HttpPost("roles/{roleId}/notes")]
    public async Task<IActionResult> AddNote(string roleId, [FromBody] NoteReq req, CancellationToken ct)
    {
        var id = NewId();
        string? taskId = null;
        // Auto-convert to task if requested
        if (req.ConvertToTask == true)
        {
            taskId = NewId();
            await E(@"INSERT INTO ""SmartTasks"" (""Id"",""OwnerId"",""Title"",""Description"",""Status"",""UserPriority"",""RequiredCognitiveLoad"",""Context"",""CreatedAt"",""UpdatedAt"")
                VALUES(@tid,@uid,@t,@d,1,3,1,0,NOW(),NOW())",
                [P("@tid",taskId),P("@uid",Uid),P("@t",req.Content?.Length > 60 ? req.Content[..60] : req.Content),P("@d",req.Content)], ct);
        }
        await E(@"INSERT INTO ""LeadershipNotes"" (""Id"",""RoleId"",""UserId"",""Content"",""ConvertedTaskId"") VALUES(@id,@rid,@uid,@c,@tid)",
            [P("@id",id),P("@rid",roleId),P("@uid",Uid),P("@c",req.Content),P("@tid",taskId)], ct);
        return Ok(new { id, convertedTaskId = taskId });
    }

    // ═══ DEV REQUESTS ════════════════════════════════════════════════════

    [HttpGet("roles/{roleId}/dev-requests")]
    public async Task<IActionResult> GetDevRequests(string roleId, CancellationToken ct) =>
        Ok(await Q(@"SELECT * FROM ""LeadershipDevRequests"" WHERE ""RoleId""=@rid AND ""UserId""=@uid ORDER BY CASE ""Status"" WHEN 'new' THEN 0 WHEN 'inReview' THEN 1 ELSE 2 END, ""CreatedAt"" DESC",
            [P("@rid",roleId),P("@uid",Uid)], ct));

    [HttpPost("roles/{roleId}/dev-requests")]
    public async Task<IActionResult> AddDevRequest(string roleId, [FromBody] DevReqReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO ""LeadershipDevRequests"" (""Id"",""RoleId"",""UserId"",""Title"",""Description"",""NextReviewDate"",""ReviewFrequency"") VALUES(@id,@rid,@uid,@t,@d,@nr,@rf)",
            [P("@id",id),P("@rid",roleId),P("@uid",Uid),P("@t",req.Title),P("@d",req.Description),P("@nr",req.NextReviewDate),P("@rf",req.ReviewFrequency??"weekly")], ct);
        return Ok(new { id });
    }

    [HttpPatch("dev-requests/{id}/status")]
    public async Task<IActionResult> UpdateDevStatus(string id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""LeadershipDevRequests"" SET ""Status""=@s WHERE ""Id""=@id AND ""UserId""=@uid",
            [P("@id",id),P("@uid",Uid),P("@s",req.Status??"new")], ct);
        return rows > 0 ? Ok(new { id, status = req.Status }) : NotFound();
    }

    [HttpDelete("notes/{id}")]
    public async Task<IActionResult> DeleteNote(string id, CancellationToken ct)
    {
        return (await E(@"DELETE FROM ""LeadershipNotes"" WHERE ""Id""=@id AND ""UserId""=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    [HttpDelete("dev-requests/{id}")]
    public async Task<IActionResult> DeleteDevRequest(string id, CancellationToken ct)
    {
        return (await E(@"DELETE FROM ""LeadershipDevRequests"" WHERE ""Id""=@id AND ""UserId""=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    // ═══ BRIEFING ════════════════════════════════════════════════════════

    [HttpGet("briefing")]
    public async Task<IActionResult> GetBriefing(CancellationToken ct)
    {
        var roles = await Q(@"SELECT ""Id"", ""Title"", ""Icon"", ""PulseStatus"", ""PulseNote"", ""NextReviewDate"" FROM ""LeadershipRoles"" WHERE ""UserId""=@uid AND ""IsActive""=true ORDER BY ""Priority""",
            Ps("@uid", Uid), ct);
        var pendingDev = await Q(@"SELECT COUNT(*) as c FROM ""LeadershipDevRequests"" WHERE ""UserId""=@uid AND ""Status"" IN ('new','inReview')",
            Ps("@uid", Uid), ct);
        var dueReviews = await Q(@"SELECT COUNT(*) as c FROM ""LeadershipRoles"" WHERE ""UserId""=@uid AND ""IsActive""=true AND ""NextReviewDate"" IS NOT NULL AND ""NextReviewDate"" <= NOW()",
            Ps("@uid", Uid), ct);
        return Ok(new
        {
            roles,
            pendingDevRequests = Convert.ToInt32(pendingDev[0]["c"] ?? 0),
            dueReviews = Convert.ToInt32(dueReviews[0]["c"] ?? 0),
        });
    }

    // ═══ HELPERS ══════════════════════════════════════════════════════════
    static string NewId() => Guid.NewGuid().ToString();
    static NpgsqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<NpgsqlParameter> Ps(string n, object? v) => [P(n, v)];

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) { var row = new Dictionary<string, object?>(); for (int i = 0; i < r.FieldCount; i++) row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i); rows.Add(row); } return rows;
        } finally { if (!w) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!w) await conn.CloseAsync(); }
    }
}

public class RoleReq { public string? Title{get;set;} public string? Organization{get;set;} public string? Sector{get;set;} public string? Description{get;set;} public DateTime? StartDate{get;set;} public string? WorkId{get;set;} public string? ReviewFrequency{get;set;} public string? Color{get;set;} public string? Icon{get;set;} public int? Priority{get;set;} }
public class PulseReq { public string? Status{get;set;} public string? Note{get;set;} }
public class NoteReq { public string? Content{get;set;} public bool? ConvertToTask{get;set;} }
public class DevReqReq { public string? Title{get;set;} public string? Description{get;set;} public DateTime? NextReviewDate{get;set;} public string? ReviewFrequency{get;set;} }
public class StatusReq { public string? Status{get;set;} }
