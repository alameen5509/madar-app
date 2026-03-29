using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/works/{workId}/requests")]
public class WorkRequestsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public WorkRequestsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(string workId, CancellationToken ct) =>
        Ok(await Q("SELECT * FROM WorkRequests WHERE WorkId=@wid AND UserId=@uid ORDER BY CASE Status WHEN 'Pending' THEN 0 WHEN 'InProgress' THEN 1 ELSE 2 END, CreatedAt DESC",
            [P("@wid",workId),P("@uid",Uid)], ct));

    [HttpPost]
    public async Task<IActionResult> Create(string workId, [FromBody] WReqReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO WorkRequests (Id,WorkId,UserId,Title,Description,Priority,Notes,Tags) VALUES(@id,@wid,@uid,@t,@d,@p,@n,@tg)",
            [P("@id",id),P("@wid",workId),P("@uid",Uid),P("@t",req.Title),P("@d",req.Description),P("@p",req.Priority??"Medium"),P("@n",req.Notes),P("@tg",req.Tags)], ct);
        return Ok(new { id, title = req.Title });
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(string workId, string id, [FromBody] WReqReq req, CancellationToken ct)
    {
        var sets = new List<string> { "UpdatedAt=NOW()" };
        var ps = new List<MySqlParameter> { P("@id",id), P("@uid",Uid) };
        if (req.Title != null) { sets.Add("Title=@t"); ps.Add(P("@t",req.Title)); }
        if (req.Description != null) { sets.Add("Description=@d"); ps.Add(P("@d",req.Description)); }
        if (req.Status != null) { sets.Add("Status=@s"); ps.Add(P("@s",req.Status)); if (req.Status == "Completed") sets.Add("CompletedAt=NOW()"); }
        if (req.Priority != null) { sets.Add("Priority=@p"); ps.Add(P("@p",req.Priority)); }
        if (req.Notes != null) { sets.Add("Notes=@n"); ps.Add(P("@n",req.Notes)); }
        var rows = await E($"UPDATE WorkRequests SET {string.Join(",",sets)} WHERE Id=@id AND UserId=@uid", ps, ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string workId, string id, CancellationToken ct) =>
        (await E("DELETE FROM WorkRequests WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();

    [HttpPost("{id}/convert")]
    public async Task<IActionResult> ConvertToProject(string workId, string id, [FromBody] ConvertReq req, CancellationToken ct)
    {
        var reqs = await Q("SELECT * FROM WorkRequests WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (reqs.Count == 0) return NotFound();
        // Create goal/project
        var projId = Guid.NewGuid().ToString();
        await E("INSERT INTO Goals (Id,OwnerId,Title,Description,Status,PriorityWeight,CreatedAt) VALUES(@id,@uid,@t,@d,0,5,NOW())",
            [P("@id",projId),P("@uid",Uid),P("@t",req.ProjectTitle ?? reqs[0]["title"]?.ToString()),P("@d",req.ProjectDescription ?? reqs[0]["description"]?.ToString())], ct);
        // Link work via raw SQL
        await E("UPDATE Goals SET WorkId=@wid WHERE Id=@id", [P("@wid",workId),P("@id",projId)], ct);
        // Create tasks if requested
        if (req.TaskTitles != null)
            foreach (var tt in req.TaskTitles.Where(t => !string.IsNullOrWhiteSpace(t)))
                await E("INSERT INTO SmartTasks (Id,OwnerId,Title,GoalId,Status,UserPriority,RequiredCognitiveLoad,Context,CreatedAt,UpdatedAt) VALUES(@id,@uid,@t,@gid,1,3,1,0,NOW(),NOW())",
                    [P("@id",Guid.NewGuid().ToString()),P("@uid",Uid),P("@t",tt),P("@gid",projId)], ct);
        // Mark request as converted
        await E("UPDATE WorkRequests SET Status='Completed',CompletedAt=NOW(),ConvertedProjectId=@pid,UpdatedAt=NOW() WHERE Id=@id",
            [P("@id",id),P("@pid",projId)], ct);
        return Ok(new { requestId = id, projectId = projId });
    }

    static MySqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection(); var w=c.State==System.Data.ConnectionState.Open; if(!w) await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);
        using var r=await cmd.ExecuteReaderAsync(ct);var rows=new List<Dictionary<string,object?>>();
        while(await r.ReadAsync(ct)){var row=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)row[char.ToLowerInvariant(r.GetName(i)[0])+r.GetName(i)[1..]]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(row);}return rows;
      }finally{if(!w)await c.CloseAsync();}}
    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection(); var w=c.State==System.Data.ConnectionState.Open; if(!w) await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);return await cmd.ExecuteNonQueryAsync(ct);
      }finally{if(!w)await c.CloseAsync();}}
}

public class WReqReq { public string? Title{get;set;} public string? Description{get;set;} public string? Status{get;set;} public string? Priority{get;set;} public string? Notes{get;set;} public string? Tags{get;set;} }
public class ConvertReq { public string? ProjectTitle{get;set;} public string? ProjectDescription{get;set;} public List<string>? TaskTitles{get;set;} }
