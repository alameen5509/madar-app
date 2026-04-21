using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/web-projects")]
public class WebProjectsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public WebProjectsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string UEmail => (User.FindFirstValue(ClaimTypes.Email)
        ?? User.FindFirstValue("email")
        ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)
        ?? "").Trim().ToLowerInvariant();

    // ═══ PROJECTS CRUD ═══
    // Access model:
    //   1. The owner sees all projects they created.
    //   2. Anyone in the owner's "team" (WebProjectTeams) sees ALL projects of that owner.
    //   3. Legacy: anyone listed in WebProjectMembers (per-project) by UserId or email.
    //
    // Team membership is the authoritative path; per-project membership is kept only for
    // backward compatibility and auto-promotes to team membership on every AddMember call.
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Ok(await Q(@"SELECT DISTINCT wp.* FROM ""WebProjects"" wp
            LEFT JOIN ""WebProjectMembers"" wm ON wm.""ProjectId"" = wp.""Id""
            LEFT JOIN ""WebProjectTeams"" wt ON wt.""OwnerId"" = wp.""OwnerId""
            WHERE wp.""OwnerId""::text=@uid
               OR wt.""UserId""::text=@uid
               OR (@email <> '' AND LOWER(TRIM(wt.""Email""))=@email)
               OR wm.""UserId""::text=@uid
               OR (@email <> '' AND LOWER(TRIM(wm.""Email""))=@email)
            ORDER BY wp.""CreatedAt"" DESC", [P("@uid", Uid), P("@email", UEmail)], ct));

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var p = await Q(@"SELECT DISTINCT wp.* FROM ""WebProjects"" wp
            LEFT JOIN ""WebProjectMembers"" wm ON wm.""ProjectId"" = wp.""Id""
            LEFT JOIN ""WebProjectTeams"" wt ON wt.""OwnerId"" = wp.""OwnerId""
            WHERE wp.""Id""::text=@id AND (
                wp.""OwnerId""::text=@uid
                OR wt.""UserId""::text=@uid
                OR (@email <> '' AND LOWER(TRIM(wt.""Email""))=@email)
                OR wm.""UserId""::text=@uid
                OR (@email <> '' AND LOWER(TRIM(wm.""Email""))=@email)
            )",
            [P("@id",id),P("@uid",Uid),P("@email",UEmail)], ct);
        if (p.Count == 0) return NotFound();
        var members = await Q("SELECT * FROM \"WebProjectMembers\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        // Determine user role: owner first, otherwise match by UserId then email
        var isOwner = p[0]["ownerId"]?.ToString() == Uid;
        var memberRole = isOwner ? "owner" : "employee";
        if (!isOwner) {
            var myMember = members.FirstOrDefault(m => m["userId"]?.ToString() == Uid)
                ?? members.FirstOrDefault(m => string.Equals((m["email"]?.ToString() ?? "").Trim(), UEmail, StringComparison.OrdinalIgnoreCase));
            if (myMember != null) memberRole = myMember["role"]?.ToString() ?? "employee";
        }
        return Ok(new { project = p[0], members, userRole = memberRole });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] WpReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO ""WebProjects"" (""Id"",""OwnerId"",""Title"",""ClientName"",""Description"",""CurrentPhase"",""Status"",""Priority"",""DueDate"",""CreatedAt"",""UpdatedAt"")
            VALUES(@id,@uid,@t,@c,@d,1,'active',@pr,@dd,NOW(),NOW())",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@c",req.ClientName),P("@d",req.Description),P("@pr",req.Priority??"medium"),P("@dd",req.DueDate)], ct);
        return Ok(new { id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] WpReq req, CancellationToken ct)
    {
        await E(@"UPDATE ""WebProjects"" SET ""Title""=COALESCE(@t,""Title""),""ClientName""=COALESCE(@c,""ClientName""),
            ""Description""=COALESCE(@d,""Description""),""CurrentPhase""=COALESCE(@p,""CurrentPhase""),""Status""=COALESCE(@s,""Status""),
            ""Priority""=COALESCE(@pr,""Priority""),""DueDate""=COALESCE(@dd,""DueDate""),""UpdatedAt""=NOW()
            WHERE ""Id""::text=@id AND ""OwnerId""::text=@uid",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@c",req.ClientName),P("@d",req.Description),P("@p",req.CurrentPhase),P("@s",req.Status),P("@pr",req.Priority),P("@dd",req.DueDate)], ct);
        return Ok(new { id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        // Use EF Core directly for reliable transaction handling
        var uid = Uid;
        var childTables = new[] { "WebProjectMembers","WebPhase1Docs","WebPhase1Tasks",
            "WebPhase3Commands","WebPhase4Credentials","WebPhase5Commands","WebPhase6Requests" };
        foreach (var t in childTables)
            try { await _db.Database.ExecuteSqlRawAsync($"DELETE FROM \"{t}\" WHERE \"ProjectId\"={{0}}", new object[]{id}, ct); } catch {}
        var rows = await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM \"WebProjects\" WHERE \"Id\"={0} AND \"OwnerId\"={1}", new object[]{id, uid}, ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    // ═══ DIAGNOSTICS ═══
    [HttpGet("whoami")]
    public async Task<IActionResult> WhoAmI(CancellationToken ct)
    {
        var memberships = await Q(
            @"SELECT wm.""Id"", wm.""ProjectId"", wm.""UserId"", wm.""Email"", wm.""Role"", wp.""Title""
              FROM ""WebProjectMembers"" wm
              JOIN ""WebProjects"" wp ON wp.""Id"" = wm.""ProjectId""
              WHERE wm.""UserId""::text=@uid OR (@email <> '' AND LOWER(TRIM(wm.""Email""))=@email)",
            [P("@uid", Uid), P("@email", UEmail)], ct);
        var teamRows = await Q(
            @"SELECT wt.""Id"", wt.""OwnerId"", wt.""UserId"", wt.""Email"", wt.""Role"",
                     (SELECT COUNT(*) FROM ""WebProjects"" wp WHERE wp.""OwnerId"" = wt.""OwnerId"") AS ownerProjectCount
              FROM ""WebProjectTeams"" wt
              WHERE wt.""UserId""::text=@uid OR (@email <> '' AND LOWER(TRIM(wt.""Email""))=@email)",
            [P("@uid", Uid), P("@email", UEmail)], ct);
        var owned = await Q("SELECT COUNT(*) AS c FROM \"WebProjects\" WHERE \"OwnerId\"=@uid",
            Ps("@uid", Uid), ct);
        var visibleProjects = await Q(
            @"SELECT DISTINCT wp.""Id"", wp.""Title"", wp.""OwnerId"" FROM ""WebProjects"" wp
              LEFT JOIN ""WebProjectMembers"" wm ON wm.""ProjectId"" = wp.""Id""
              LEFT JOIN ""WebProjectTeams"" wt ON wt.""OwnerId"" = wp.""OwnerId""
              WHERE wp.""OwnerId""::text=@uid
                 OR wt.""UserId""::text=@uid
                 OR (@email <> '' AND LOWER(TRIM(wt.""Email""))=@email)
                 OR wm.""UserId""::text=@uid
                 OR (@email <> '' AND LOWER(TRIM(wm.""Email""))=@email)",
            [P("@uid", Uid), P("@email", UEmail)], ct);
        return Ok(new {
            userId = Uid,
            email = UEmail,
            ownedCount = owned[0]["c"],
            membershipCount = memberships.Count,
            teamCount = teamRows.Count,
            visibleProjectCount = visibleProjects.Count,
            memberships,
            team = teamRows,
            visibleProjects
        });
    }

    // ═══ MEMBERS ═══
    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(string id, [FromBody] WpMemberReq req, CancellationToken ct)
    {
        var mid = NewId();
        var email = (req.Email ?? "").Trim();
        // Resolve UserId from AspNetUsers by email so lookups don't depend on email matching
        string? userId = null;
        if (email.Length > 0)
        {
            var rows = await Q("SELECT \"Id\" FROM \"AspNetUsers\" WHERE LOWER(TRIM(\"Email\"))=@e LIMIT 1",
                Ps("@e", email.ToLowerInvariant()), ct);
            if (rows.Count > 0) userId = rows[0]["id"]?.ToString();
        }
        // Per-project membership (legacy)
        await E("INSERT INTO \"WebProjectMembers\" (\"Id\",\"ProjectId\",\"UserId\",\"Name\",\"Email\",\"Role\",\"AddedAt\") VALUES(@mid,@pid,@uid,@n,@e,@r,NOW())",
            [P("@mid",mid),P("@pid",id),P("@uid",userId),P("@n",req.Name),P("@e",email),P("@r",req.Role??"employee")], ct);

        // Promote to owner-team membership so this user sees ALL my projects (the source of truth).
        // Look up the project's owner; this also enforces that only the owner of the project added it.
        var ownerRows = await Q("SELECT \"OwnerId\" FROM \"WebProjects\" WHERE \"Id\"=@pid LIMIT 1", Ps("@pid", id), ct);
        if (ownerRows.Count > 0)
        {
            var ownerId = ownerRows[0]["ownerId"]?.ToString();
            if (ownerId == Uid) // only the project owner may grant team access
            {
                // Dedupe: if a row with this owner+email/userId exists, do nothing
                var existing = await Q(
                    @"SELECT ""Id"" FROM ""WebProjectTeams""
                      WHERE ""OwnerId""::text=@oid
                        AND ((@uid IS NOT NULL AND ""UserId""::text=@uid)
                             OR (@e <> '' AND LOWER(TRIM(""Email""))=@e))
                      LIMIT 1",
                    [P("@oid", ownerId), P("@uid", userId), P("@e", email.ToLowerInvariant())], ct);
                if (existing.Count == 0)
                {
                    await E(@"INSERT INTO ""WebProjectTeams"" (""Id"",""OwnerId"",""UserId"",""Name"",""Email"",""Role"",""AddedAt"")
                              VALUES(@tid,@oid,@uid,@n,@e,@r,NOW())",
                        [P("@tid", NewId()), P("@oid", ownerId), P("@uid", userId),
                         P("@n", req.Name), P("@e", email), P("@r", req.Role ?? "employee")], ct);
                }
            }
        }
        return Ok(new { id = mid, userId, resolved = userId != null });
    }

    // ═══ OWNER TEAM (root of access — see all my projects) ═══
    [HttpGet("team")]
    public async Task<IActionResult> GetTeam(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebProjectTeams\" WHERE \"OwnerId\"=@uid ORDER BY \"AddedAt\" DESC", Ps("@uid", Uid), ct));

    [HttpDelete("team/{tid}")]
    public async Task<IActionResult> RemoveTeamMember(string tid, CancellationToken ct)
    {
        await E("DELETE FROM \"WebProjectTeams\" WHERE \"Id\"=@tid AND \"OwnerId\"=@uid", [P("@tid", tid), P("@uid", Uid)], ct);
        return NoContent();
    }

    [HttpDelete("{id}/members/{mid}")]
    public async Task<IActionResult> RemoveMember(string id, string mid, CancellationToken ct)
    {
        await E("DELETE FROM \"WebProjectMembers\" WHERE \"Id\"=@mid AND \"ProjectId\"=@pid", [P("@mid",mid),P("@pid",id)], ct);
        return NoContent();
    }

    // ═══ PHASE 1: Ideas & Tasks ═══
    [HttpGet("{id}/phase1/document")]
    public async Task<IActionResult> GetPhase1Doc(string id, CancellationToken ct)
    {
        var r = await Q("SELECT \"Content\" FROM \"WebPhase1Docs\" WHERE \"ProjectId\"=@id ORDER BY \"UpdatedAt\" DESC LIMIT 1", Ps("@id",id), ct);
        return Ok(new { content = r.Count > 0 ? r[0]["content"]?.ToString() : "" });
    }

    [HttpPut("{id}/phase1/document")]
    public async Task<IActionResult> SavePhase1Doc(string id, [FromBody] DocReq req, CancellationToken ct)
    {
        var existing = await Q("SELECT \"Id\" FROM \"WebPhase1Docs\" WHERE \"ProjectId\"=@id LIMIT 1", Ps("@id",id), ct);
        if (existing.Count > 0)
            await E("UPDATE \"WebPhase1Docs\" SET \"Content\"=@c,\"UpdatedAt\"=NOW() WHERE \"Id\"=@eid", [P("@eid",existing[0]["id"]!.ToString()!),P("@c",req.Content)], ct);
        else
            await E("INSERT INTO \"WebPhase1Docs\" (\"Id\",\"ProjectId\",\"Content\",\"UpdatedAt\") VALUES(@nid,@id,@c,NOW())", [P("@nid",NewId()),P("@id",id),P("@c",req.Content)], ct);
        return Ok(new { saved = true });
    }

    [HttpGet("{id}/phase1/tasks")]
    public async Task<IActionResult> GetPhase1Tasks(string id, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebPhase1Tasks\" WHERE \"ProjectId\"=@id ORDER BY \"Order\"", Ps("@id",id), ct));

    [HttpPost("{id}/phase1/tasks")]
    public async Task<IActionResult> AddPhase1Task(string id, [FromBody] WpTaskReq req, CancellationToken ct)
    {
        var tid = NewId();
        var maxOrder = await Q("SELECT MAX(\"Order\") as m FROM \"WebPhase1Tasks\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var order = Convert.ToInt32(maxOrder[0]["m"] ?? 0) + 1;
        await E("INSERT INTO \"WebPhase1Tasks\" (\"Id\",\"ProjectId\",\"Title\",\"AssignedTo\",\"Status\",\"Order\",\"CreatedAt\") VALUES(@tid,@pid,@t,@a,'pending',@o,NOW())",
            [P("@tid",tid),P("@pid",id),P("@t",req.Title),P("@a",req.AssignedTo),P("@o",order)], ct);
        return Ok(new { id = tid });
    }

    [HttpPatch("{id}/phase1/tasks/{taskId}")]
    public async Task<IActionResult> UpdatePhase1Task(string id, string taskId, [FromBody] WpTaskReq req, CancellationToken ct)
    {
        await E("UPDATE \"WebPhase1Tasks\" SET \"Title\"=COALESCE(@t,\"Title\"),\"AssignedTo\"=COALESCE(@a,\"AssignedTo\"),\"Status\"=COALESCE(@s,\"Status\") WHERE \"Id\"=@tid AND \"ProjectId\"=@pid",
            [P("@tid",taskId),P("@pid",id),P("@t",req.Title),P("@a",req.AssignedTo),P("@s",req.Status)], ct);
        return Ok(new { id = taskId });
    }

    [HttpDelete("{id}/phase1/tasks/{taskId}")]
    public async Task<IActionResult> DeletePhase1Task(string id, string taskId, CancellationToken ct)
    {
        await E("DELETE FROM \"WebPhase1Tasks\" WHERE \"Id\"=@tid AND \"ProjectId\"=@pid", [P("@tid",taskId),P("@pid",id)], ct);
        return NoContent();
    }

    // ═══ PHASE 3: Setup Commands ═══
    [HttpGet("{id}/phase3/commands")]
    public async Task<IActionResult> GetPhase3Cmds(string id, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebPhase3Commands\" WHERE \"ProjectId\"=@id ORDER BY \"Order\"", Ps("@id",id), ct));

    [HttpPost("{id}/phase3/commands")]
    public async Task<IActionResult> AddPhase3Cmd(string id, [FromBody] CmdReq req, CancellationToken ct)
    {
        var cid = NewId();
        var maxOrder = await Q("SELECT MAX(\"Order\") as m FROM \"WebPhase3Commands\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var order = Convert.ToInt32(maxOrder[0]["m"] ?? 0) + 1;
        await E("INSERT INTO \"WebPhase3Commands\" (\"Id\",\"ProjectId\",\"Title\",\"Command\",\"Order\",\"Status\",\"CreatedAt\") VALUES(@cid,@pid,@t,@cmd,@o,'pending',NOW())",
            [P("@cid",cid),P("@pid",id),P("@t",req.Title),P("@cmd",req.Command),P("@o",order)], ct);
        return Ok(new { id = cid });
    }

    [HttpPatch("{id}/phase3/commands/{cmdId}/done")]
    public async Task<IActionResult> Phase3CmdDone(string id, string cmdId, CancellationToken ct)
    {
        await E("UPDATE \"WebPhase3Commands\" SET \"Status\"='done',\"DoneAt\"=NOW() WHERE \"Id\"=@cid AND \"ProjectId\"=@pid",
            [P("@cid",cmdId),P("@pid",id)], ct);
        return Ok(new { id = cmdId, status = "done" });
    }

    [HttpGet("{id}/phase3/next-command")]
    public async Task<IActionResult> GetNextPhase3Cmd(string id, CancellationToken ct)
    {
        var r = await Q("SELECT * FROM \"WebPhase3Commands\" WHERE \"ProjectId\"=@id AND \"Status\"='pending' ORDER BY \"Order\" LIMIT 1", Ps("@id",id), ct);
        return Ok(r.Count > 0 ? r[0] : null);
    }

    // ═══ PHASE 4: Credentials ═══
    [HttpGet("{id}/phase4/credentials")]
    public async Task<IActionResult> GetCredentials(string id, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebPhase4Credentials\" WHERE \"ProjectId\"=@id ORDER BY \"CreatedAt\"", Ps("@id",id), ct));

    [HttpPost("{id}/phase4/credentials")]
    public async Task<IActionResult> AddCredential(string id, [FromBody] CredReq req, CancellationToken ct)
    {
        var cid = NewId();
        await E("INSERT INTO \"WebPhase4Credentials\" (\"Id\",\"ProjectId\",\"Type\",\"Label\",\"Value\",\"CreatedAt\") VALUES(@cid,@pid,@t,@l,@v,NOW())",
            [P("@cid",cid),P("@pid",id),P("@t",req.Type),P("@l",req.Label),P("@v",req.Value)], ct);
        return Ok(new { id = cid });
    }

    [HttpDelete("{id}/phase4/credentials/{credId}")]
    public async Task<IActionResult> DeleteCredential(string id, string credId, CancellationToken ct)
    {
        await E("DELETE FROM \"WebPhase4Credentials\" WHERE \"Id\"=@cid AND \"ProjectId\"=@pid", [P("@cid",credId),P("@pid",id)], ct);
        return NoContent();
    }

    // ═══ PHASE 5: Dev Commands ═══
    [HttpGet("{id}/phase5/commands")]
    public async Task<IActionResult> GetPhase5Cmds(string id, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebPhase5Commands\" WHERE \"ProjectId\"=@id ORDER BY \"Order\"", Ps("@id",id), ct));

    [HttpPost("{id}/phase5/commands")]
    public async Task<IActionResult> AddPhase5Cmd(string id, [FromBody] CmdReq req, CancellationToken ct)
    {
        var cid = NewId();
        var maxOrder = await Q("SELECT MAX(\"Order\") as m FROM \"WebPhase5Commands\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var order = Convert.ToInt32(maxOrder[0]["m"] ?? 0) + 1;
        await E("INSERT INTO \"WebPhase5Commands\" (\"Id\",\"ProjectId\",\"Title\",\"Command\",\"Order\",\"Status\",\"AddedBy\",\"CreatedAt\") VALUES(@cid,@pid,@t,@cmd,@o,'pending',@uid,NOW())",
            [P("@cid",cid),P("@pid",id),P("@t",req.Title),P("@cmd",req.Command),P("@o",order),P("@uid",Uid)], ct);
        return Ok(new { id = cid });
    }

    [HttpPatch("{id}/phase5/commands/{cmdId}/employee-done")]
    public async Task<IActionResult> Phase5EmployeeDone(string id, string cmdId, CancellationToken ct)
    {
        await E("UPDATE \"WebPhase5Commands\" SET \"Status\"='employeeDone',\"EmployeeDoneAt\"=NOW() WHERE \"Id\"=@cid AND \"ProjectId\"=@pid",
            [P("@cid",cmdId),P("@pid",id)], ct);
        return Ok(new { id = cmdId, status = "employeeDone" });
    }

    [HttpPatch("{id}/phase5/commands/{cmdId}/owner-approve")]
    public async Task<IActionResult> Phase5OwnerApprove(string id, string cmdId, [FromBody] WpNoteReq? req, CancellationToken ct)
    {
        await E("UPDATE \"WebPhase5Commands\" SET \"Status\"='closed',\"OwnerApprovedAt\"=NOW(),\"Notes\"=COALESCE(@n,\"Notes\") WHERE \"Id\"=@cid AND \"ProjectId\"=@pid",
            [P("@cid",cmdId),P("@pid",id),P("@n",req?.Notes)], ct);
        return Ok(new { id = cmdId, status = "closed" });
    }

    // ═══ PHASE 6: Client Requests ═══
    [HttpGet("{id}/phase6/requests")]
    public async Task<IActionResult> GetPhase6Reqs(string id, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM \"WebPhase6Requests\" WHERE \"ProjectId\"=@id ORDER BY \"CreatedAt\" DESC", Ps("@id",id), ct));

    [HttpPost("{id}/phase6/requests")]
    public async Task<IActionResult> AddPhase6Req(string id, [FromBody] ClientReqReq req, CancellationToken ct)
    {
        var rid = NewId();
        await E("INSERT INTO \"WebPhase6Requests\" (\"Id\",\"ProjectId\",\"Title\",\"Description\",\"Status\",\"ClientNote\",\"CreatedAt\") VALUES(@rid,@pid,@t,@d,'new',@cn,NOW())",
            [P("@rid",rid),P("@pid",id),P("@t",req.Title),P("@d",req.Description),P("@cn",req.ClientNote)], ct);
        return Ok(new { id = rid });
    }

    [HttpPatch("{id}/phase6/requests/{reqId}")]
    public async Task<IActionResult> UpdatePhase6Req(string id, string reqId, [FromBody] ClientReqReq req, CancellationToken ct)
    {
        await E("UPDATE \"WebPhase6Requests\" SET \"Status\"=COALESCE(@s,\"Status\"),\"OwnerNote\"=COALESCE(@on,\"OwnerNote\") WHERE \"Id\"=@rid AND \"ProjectId\"=@pid",
            [P("@rid",reqId),P("@pid",id),P("@s",req.Status),P("@on",req.OwnerNote)], ct);
        return Ok(new { id = reqId });
    }

    // ═══ DASHBOARD ═══
    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetDashboard(string id, CancellationToken ct)
    {
        var p1Tasks = await Q("SELECT COUNT(*) as total, SUM(CASE WHEN \"Status\"='done' THEN 1 ELSE 0 END) as done FROM \"WebPhase1Tasks\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var p3Cmds = await Q("SELECT COUNT(*) as total, SUM(CASE WHEN \"Status\"='done' THEN 1 ELSE 0 END) as done FROM \"WebPhase3Commands\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var p5Cmds = await Q("SELECT COUNT(*) as total, SUM(CASE WHEN \"Status\"='closed' THEN 1 ELSE 0 END) as closed, SUM(CASE WHEN \"Status\"='employeeDone' THEN 1 ELSE 0 END) as review FROM \"WebPhase5Commands\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        var p6Reqs = await Q("SELECT COUNT(*) as total, SUM(CASE WHEN \"Status\"='done' THEN 1 ELSE 0 END) as done FROM \"WebPhase6Requests\" WHERE \"ProjectId\"=@id", Ps("@id",id), ct);
        return Ok(new { phase1 = p1Tasks[0], phase3 = p3Cmds[0], phase5 = p5Cmds[0], phase6 = p6Reqs[0] });
    }

    // ═══ HELPERS ═══
    static string NewId() => Guid.NewGuid().ToString();
    // ═══ GENERIC KEY-VALUE STORE (replaces localStorage) ═══

    [HttpGet("{id}/kv/{key}")]
    public async Task<IActionResult> GetKV(string id, string key, CancellationToken ct)
    {
        // Ensure table exists
        try { await E("CREATE TABLE IF NOT EXISTS \"WebProjectKV\" (\"ProjectId\" VARCHAR(36) NOT NULL, \"Key\" VARCHAR(100) NOT NULL, \"Value\" TEXT, \"UpdatedAt\" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (\"ProjectId\", \"Key\"))", [], ct); } catch {}
        var rows = await Q("SELECT \"Value\" FROM \"WebProjectKV\" WHERE \"ProjectId\"=@pid AND \"Key\"=@k LIMIT 1", [P("@pid", id), P("@k", key)], ct);
        if (rows.Count == 0) return Ok(new { value = (string?)null });
        return Ok(new { value = rows[0]["value"]?.ToString() });
    }

    [HttpPut("{id}/kv/{key}")]
    public async Task<IActionResult> SetKV(string id, string key, [FromBody] KVReq req, CancellationToken ct)
    {
        try { await E("CREATE TABLE IF NOT EXISTS \"WebProjectKV\" (\"ProjectId\" VARCHAR(36) NOT NULL, \"Key\" VARCHAR(100) NOT NULL, \"Value\" TEXT, \"UpdatedAt\" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (\"ProjectId\", \"Key\"))", [], ct); } catch {}
        await E("INSERT INTO \"WebProjectKV\" (\"ProjectId\", \"Key\", \"Value\", \"UpdatedAt\") VALUES(@pid, @k, @v, NOW()) ON CONFLICT (\"ProjectId\", \"Key\") DO UPDATE SET \"Value\"=EXCLUDED.\"Value\", \"UpdatedAt\"=NOW()",
            [P("@pid", id), P("@k", key), P("@v", req.Value)], ct);
        return Ok(new { success = true });
    }

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

public class WpReq { public string? Title{get;set;} public string? ClientName{get;set;} public string? Description{get;set;} public int? CurrentPhase{get;set;} public string? Status{get;set;} public string? Priority{get;set;} public string? DueDate{get;set;} }
public class WpMemberReq { public string? Name{get;set;} public string? Email{get;set;} public string? Role{get;set;} }
public class DocReq { public string? Content{get;set;} }
public class WpTaskReq { public string? Title{get;set;} public string? AssignedTo{get;set;} public string? Status{get;set;} }
public class CmdReq { public string? Title{get;set;} public string? Command{get;set;} }
public class CredReq { public string? Type{get;set;} public string? Label{get;set;} public string? Value{get;set;} }
public class ClientReqReq { public string? Title{get;set;} public string? Description{get;set;} public string? ClientNote{get;set;} public string? OwnerNote{get;set;} public string? Status{get;set;} }
public class WpNoteReq { public string? Notes{get;set;} }
public class KVReq { public string? Value{get;set;} }
