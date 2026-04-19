using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/dev-tickets")]
public class DevTicketsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public DevTicketsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await Q(@"SELECT * FROM ""DevTickets"" WHERE ""UserId""=@uid ORDER BY
            CASE ""Status"" WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
            ""CreatedAt"" DESC",
            [new("@uid", Uid)], ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketReq req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "العنوان مطلوب" });
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO ""DevTickets"" (""Id"",""UserId"",""Title"",""UserRequest"",""AiCommand"",""Status"",""Attempts"",""CreatedAt"",""UpdatedAt"")
            VALUES(@id,@uid,@t,@ur,@cmd,'open',0,NOW(),NOW())",
            [new("@id",id),new("@uid",Uid),new("@t",req.Title),
             new("@ur",(object?)req.Description??DBNull.Value),new("@cmd",(object?)req.Command??DBNull.Value)], ct);
        return Ok(new { id, title = req.Title, command = req.Command, status = "open" });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateTicketReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""DevTickets"" SET
            ""Title""=COALESCE(@t,""Title""), ""UserRequest""=COALESCE(@ur,""UserRequest""),
            ""AiCommand""=COALESCE(@cmd,""AiCommand""), ""Status""=COALESCE(@st,""Status""), ""UpdatedAt""=NOW()
            WHERE ""Id""=@id AND ""UserId""=@uid",
            [new("@id",id),new("@uid",Uid),new("@t",(object?)req.Title??DBNull.Value),
             new("@ur",(object?)req.Description??DBNull.Value),new("@cmd",(object?)req.Command??DBNull.Value),
             new("@st",(object?)req.Status??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpPatch("{id}/resolve")]
    public async Task<IActionResult> Resolve(string id, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""DevTickets"" SET ""Status""='resolved', ""ResolvedAt""=NOW(), ""UpdatedAt""=NOW()
            WHERE ""Id""=@id AND ""UserId""=@uid", [new("@id",id),new("@uid",Uid)], ct);
        return rows > 0 ? Ok(new { id, status = "resolved" }) : NotFound();
    }

    [HttpPatch("{id}/not-modified")]
    public async Task<IActionResult> NotModified(string id, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""DevTickets"" SET ""Status""='not_modified', ""UpdatedAt""=NOW()
            WHERE ""Id""=@id AND ""UserId""=@uid", [new("@id",id),new("@uid",Uid)], ct);
        return rows > 0 ? Ok(new { id, status = "not_modified" }) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await E("DELETE FROM \"DevTicketHistory\" WHERE \"TicketId\"=@id", [new("@id",id)], ct);
        return (await E("DELETE FROM \"DevTickets\" WHERE \"Id\"=@id AND \"UserId\"=@uid", [new("@id",id),new("@uid",Uid)], ct)) > 0
            ? NoContent() : NotFound();
    }

    // Context (kept for project notes)
    [HttpGet("context")]
    public async Task<IActionResult> GetContext(CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM \"DevContext\" WHERE \"UserId\"=@uid AND \"IsActive\"=1 LIMIT 1", [new("@uid", Uid)], ct);
        return Ok(rows.Count > 0 ? rows[0] : new Dictionary<string, object?> { ["content"] = "" });
    }

    [HttpPut("context")]
    public async Task<IActionResult> SaveContext([FromBody] ContextReq req, CancellationToken ct)
    {
        var existing = await Q("SELECT \"Id\" FROM \"DevContext\" WHERE \"UserId\"=@uid AND \"IsActive\"=1 LIMIT 1", [new("@uid", Uid)], ct);
        if (existing.Count > 0)
            await E("UPDATE \"DevContext\" SET \"Content\"=@c, \"UpdatedAt\"=NOW() WHERE \"Id\"=@id",
                [new("@id", existing[0]["id"]!.ToString()!), new("@c", req.Content ?? "")], ct);
        else
            await E("INSERT INTO \"DevContext\" (\"Id\",\"UserId\",\"Content\",\"IsActive\",\"UpdatedAt\") VALUES(@id,@uid,@c,1,NOW())",
                [new("@id", Guid.NewGuid().ToString()), new("@uid", Uid), new("@c", req.Content ?? "")], ct);
        return Ok(new { saved = true });
    }

    // Helpers
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

public class CreateTicketReq { public string? Title{get;set;} public string? Description{get;set;} public string? Command{get;set;} }
public class UpdateTicketReq { public string? Title{get;set;} public string? Description{get;set;} public string? Command{get;set;} public string? Status{get;set;} }
public class ContextReq { public string? Content{get;set;} }
