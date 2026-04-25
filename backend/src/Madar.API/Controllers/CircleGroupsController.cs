using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/circle-groups")]
public class CircleGroupsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public CircleGroupsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ─── Groups ─────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var uid = Uid;
        // Also try lowercase — TiDB may store GUIDs differently
        var groups = await Q(@"SELECT * FROM ""CircleGroups""
            WHERE ""UserId""::text=@uid OR ""UserId""::text=@uidLower
            ORDER BY ""Priority"", ""CreatedAt""",
            [P("@uid", uid), P("@uidLower", uid.ToLowerInvariant())], ct);

        var circles = await Q(@"SELECT * FROM ""UserCircles""
            WHERE ""UserId""::text=@uid OR ""UserId""::text=@uidLower
            ORDER BY ""Priority"", ""CreatedAt""",
            [P("@uid", uid), P("@uidLower", uid.ToLowerInvariant())], ct);

        // Nest circles inside groups
        var result = groups.Select(g => {
            var gid = g["id"]?.ToString();
            return new Dictionary<string, object?>(g)
            {
                ["circles"] = circles.Where(c => c["groupId"]?.ToString() == gid).ToList()
            };
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateGroup([FromBody] GroupReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await E(@"INSERT INTO ""CircleGroups"" (""Id"",""UserId"",""Name"",""Color"",""Icon"",""Priority"")
            VALUES(@id,@uid,@n,@c,@i,@p)",
            [P("@id",id.ToString()),P("@uid",Uid),P("@n",req.Name??""),
             P("@c",(object?)req.Color??DBNull.Value),P("@i",(object?)req.Icon??DBNull.Value),
             P("@p",req.Priority??0)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateGroup(Guid id, [FromBody] GroupReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE ""CircleGroups"" SET ""Name""=COALESCE(@n,""Name""),""Color""=COALESCE(@c,""Color""),
            ""Icon""=COALESCE(@i,""Icon""),""Priority""=COALESCE(@p,""Priority"") WHERE ""Id""::text=@id AND ""UserId""::text=@uid",
            [P("@id",id.ToString()),P("@uid",Uid),P("@n",(object?)req.Name??DBNull.Value),
             P("@c",(object?)req.Color??DBNull.Value),P("@i",(object?)req.Icon??DBNull.Value),
             P("@p",(object?)req.Priority??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken ct)
    {
        await E("DELETE FROM \"UserCircles\" WHERE \"GroupId\"=@gid AND \"UserId\"=@uid",
            [P("@gid",id.ToString()),P("@uid",Uid)], ct);
        var rows = await E("DELETE FROM \"CircleGroups\" WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id",id.ToString()),P("@uid",Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    // ─── Circles ────────────────────────────────────────────────────────

    [HttpPost("{groupId:guid}/circles")]
    public async Task<IActionResult> CreateCircle(Guid groupId, [FromBody] CircleReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var slug = (req.Slug ?? req.Name ?? "").Trim().ToLowerInvariant().Replace(" ", "-");
        await E(@"INSERT INTO ""UserCircles"" (""Id"",""UserId"",""GroupId"",""Name"",""Color"",""Icon"",""Slug"",""Priority"")
            VALUES(@id,@uid,@gid,@n,@c,@i,@s,@p)",
            [P("@id",id.ToString()),P("@uid",Uid),P("@gid",groupId.ToString()),
             P("@n",req.Name??""),P("@c",(object?)req.Color??DBNull.Value),
             P("@i",(object?)req.Icon??DBNull.Value),P("@s",slug),
             P("@p",req.Priority??0)], ct);
        return Ok(new { id, name = req.Name, slug });
    }

    [HttpPut("circles/{id:guid}")]
    public async Task<IActionResult> UpdateCircle(Guid id, [FromBody] CircleReq req, CancellationToken ct)
    {
        var slug = req.Slug != null ? req.Slug.Trim().ToLowerInvariant().Replace(" ", "-") : null;
        var rows = await E(@"UPDATE ""UserCircles"" SET ""Name""=COALESCE(@n,""Name""),""Color""=COALESCE(@c,""Color""),
            ""Icon""=COALESCE(@i,""Icon""),""Slug""=COALESCE(@s,""Slug""),""Priority""=COALESCE(@p,""Priority"")
            WHERE ""Id""::text=@id AND ""UserId""::text=@uid",
            [P("@id",id.ToString()),P("@uid",Uid),P("@n",(object?)req.Name??DBNull.Value),
             P("@c",(object?)req.Color??DBNull.Value),P("@i",(object?)req.Icon??DBNull.Value),
             P("@s",(object?)slug??DBNull.Value),P("@p",(object?)req.Priority??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("circles/{id:guid}")]
    public async Task<IActionResult> DeleteCircle(Guid id, CancellationToken ct)
    {
        var rows = await E("DELETE FROM \"UserCircles\" WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id",id.ToString()),P("@uid",Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    [HttpGet("circles/{slugOrId}")]
    public async Task<IActionResult> GetBySlugOrId(string slugOrId, CancellationToken ct)
    {
        // Match by Slug OR Id (legacy circles created before the Slug column existed
        // have NULL slugs, so the frontend falls back to linking by Id).
        var rows = await Q(
            "SELECT * FROM \"UserCircles\" WHERE (\"Slug\"=@s OR \"Id\"=@s) AND \"UserId\"=@uid LIMIT 1",
            [P("@s", slugOrId), P("@uid", Uid)], ct);
        return rows.Count > 0 ? Ok(rows[0]) : NotFound();
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    static NpgsqlParameter P(string n, object? v) =>
        v is string s && Guid.TryParse(s, out var g)
            ? new NpgsqlParameter(n, NpgsqlTypes.NpgsqlDbType.Uuid) { Value = g }
            : new(n, v ?? DBNull.Value);

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct);
            var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < r.FieldCount; i++)
                    row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }
}

public class GroupReq
{
    public string? Name { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int? Priority { get; set; }
}

public class CircleReq
{
    public string? Name { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public string? Slug { get; set; }
    public int? Priority { get; set; }
}
