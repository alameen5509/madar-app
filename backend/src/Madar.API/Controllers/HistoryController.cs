using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/history")]
public class HistoryController : ControllerBase
{
    private readonly MadarDbContext _db;
    public HistoryController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ─── Hijri ↔ Gregorian approximate conversion ───────────────────────
    static int HijriToGregorian(int h) => (int)Math.Round(h * 0.970229 + 621.5709);
    static int GregorianToHijri(int g) => (int)Math.Round((g - 621.5709) / 0.970229);

    // ─── Records CRUD ───────────────────────────────────────────────────

    [HttpGet("records")]
    public async Task<IActionResult> GetRecords(
        [FromQuery] int? from, [FromQuery] int? to,
        [FromQuery] string? category, [FromQuery] string? country,
        CancellationToken ct)
    {
        var sql = "SELECT * FROM HistoryRecords WHERE UserId=@uid";
        var ps = new List<MySqlParameter> { new("@uid", Uid) };
        if (from.HasValue) { sql += " AND Year>=@f"; ps.Add(new("@f", from.Value)); }
        if (to.HasValue) { sql += " AND Year<=@t"; ps.Add(new("@t", to.Value)); }
        if (!string.IsNullOrEmpty(category)) { sql += " AND Category=@c"; ps.Add(new("@c", category)); }
        if (!string.IsNullOrEmpty(country)) { sql += " AND Country=@co"; ps.Add(new("@co", country)); }
        sql += " ORDER BY Year ASC";

        return Ok(await Query(sql, ps, ct));
    }

    [HttpGet("records/{id:guid}")]
    public async Task<IActionResult> GetRecord(Guid id, CancellationToken ct)
    {
        var rows = await Query("SELECT * FROM HistoryRecords WHERE Id=@id AND UserId=@uid",
            [new("@id", id.ToString()), new("@uid", Uid)], ct);
        return rows.Count > 0 ? Ok(rows[0]) : NotFound();
    }

    [HttpPost("records")]
    public async Task<IActionResult> CreateRecord([FromBody] HistoryRecordReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        int year, hijriYear;
        if (req.InputType == "hijri")
        {
            hijriYear = req.HijriYear ?? req.Year;
            year = HijriToGregorian(hijriYear);
        }
        else
        {
            year = req.Year;
            hijriYear = GregorianToHijri(year);
        }

        await Exec(@"INSERT INTO HistoryRecords (Id,UserId,Year,HijriYear,InputType,Title,Description,Figure,Location,Country,Category,StrategicImportance,Importance,Source,Tags)
            VALUES(@id,@uid,@y,@hy,@it,@ti,@de,@fi,@lo,@co,@ca,@si,@im,@so,@ta)",
            [new("@id",id.ToString()),new("@uid",Uid),new("@y",year),new("@hy",hijriYear),
             new("@it",req.InputType??"gregorian"),new("@ti",req.Title??""),new("@de",(object?)req.Description??DBNull.Value),
             new("@fi",(object?)req.Figure??DBNull.Value),new("@lo",(object?)req.Location??DBNull.Value),
             new("@co",(object?)req.Country??DBNull.Value),new("@ca",req.Category??"other"),
             new("@si",(object?)req.StrategicImportance??DBNull.Value),new("@im",req.Importance??"normal"),
             new("@so",(object?)req.Source??DBNull.Value),new("@ta",(object?)req.Tags??DBNull.Value)], ct);

        return Ok(new { id, year, hijriYear, title = req.Title });
    }

    [HttpPut("records/{id:guid}")]
    public async Task<IActionResult> UpdateRecord(Guid id, [FromBody] HistoryRecordReq req, CancellationToken ct)
    {
        int year, hijriYear;
        if (req.InputType == "hijri")
        {
            hijriYear = req.HijriYear ?? req.Year;
            year = HijriToGregorian(hijriYear);
        }
        else
        {
            year = req.Year;
            hijriYear = GregorianToHijri(year);
        }

        var rows = await Exec(@"UPDATE HistoryRecords SET Year=@y,HijriYear=@hy,InputType=@it,Title=@ti,Description=@de,
            Figure=@fi,Location=@lo,Country=@co,Category=@ca,StrategicImportance=@si,Importance=@im,Source=@so,Tags=@ta
            WHERE Id=@id AND UserId=@uid",
            [new("@id",id.ToString()),new("@uid",Uid),new("@y",year),new("@hy",hijriYear),
             new("@it",req.InputType??"gregorian"),new("@ti",req.Title??""),new("@de",(object?)req.Description??DBNull.Value),
             new("@fi",(object?)req.Figure??DBNull.Value),new("@lo",(object?)req.Location??DBNull.Value),
             new("@co",(object?)req.Country??DBNull.Value),new("@ca",req.Category??"other"),
             new("@si",(object?)req.StrategicImportance??DBNull.Value),new("@im",req.Importance??"normal"),
             new("@so",(object?)req.Source??DBNull.Value),new("@ta",(object?)req.Tags??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("records/{id:guid}")]
    public async Task<IActionResult> DeleteRecord(Guid id, CancellationToken ct)
    {
        var rows = await Exec("DELETE FROM HistoryRecords WHERE Id=@id AND UserId=@uid",
            [new("@id", id.ToString()), new("@uid", Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    // ─── Timeline (grouped by era/century) ──────────────────────────────

    [HttpGet("timeline")]
    public async Task<IActionResult> GetTimeline(
        [FromQuery] int? from, [FromQuery] int? to,
        [FromQuery] string? category, [FromQuery] string? country,
        CancellationToken ct)
    {
        var records = await GetRecords(from, to, category, country, ct);
        return Ok(records);
    }

    // ─── Search ─────────────────────────────────────────────────────────

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q, [FromQuery] int? year, [FromQuery] string? country,
        CancellationToken ct)
    {
        var sql = "SELECT * FROM HistoryRecords WHERE UserId=@uid";
        var ps = new List<MySqlParameter> { new("@uid", Uid) };
        if (!string.IsNullOrEmpty(q)) { sql += " AND (Title LIKE @q OR Description LIKE @q OR Figure LIKE @q)"; ps.Add(new("@q", $"%{q}%")); }
        if (year.HasValue) { sql += " AND (Year=@y OR HijriYear=@y)"; ps.Add(new("@y", year.Value)); }
        if (!string.IsNullOrEmpty(country)) { sql += " AND Country=@co"; ps.Add(new("@co", country)); }
        sql += " ORDER BY Year ASC LIMIT 100";
        return Ok(await Query(sql, ps, ct));
    }

    // ─── Figures ────────────────────────────────────────────────────────

    [HttpGet("figures")]
    public async Task<IActionResult> GetFigures(CancellationToken ct)
    {
        return Ok(await Query("SELECT * FROM HistoryFigures WHERE UserId=@uid ORDER BY Name",
            [new("@uid", Uid)], ct));
    }

    [HttpPost("figures")]
    public async Task<IActionResult> CreateFigure([FromBody] HistoryFigureReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await Exec(@"INSERT INTO HistoryFigures (Id,UserId,Name,BirthYear,DeathYear,Role,Nationality,Category,Bio)
            VALUES(@id,@uid,@n,@by,@dy,@r,@na,@ca,@bi)",
            [new("@id",id.ToString()),new("@uid",Uid),new("@n",req.Name??""),
             new("@by",(object?)req.BirthYear??DBNull.Value),new("@dy",(object?)req.DeathYear??DBNull.Value),
             new("@r",(object?)req.Role??DBNull.Value),new("@na",(object?)req.Nationality??DBNull.Value),
             new("@ca",(object?)req.Category??DBNull.Value),new("@bi",(object?)req.Bio??DBNull.Value)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpDelete("figures/{id:guid}")]
    public async Task<IActionResult> DeleteFigure(Guid id, CancellationToken ct)
    {
        var rows = await Exec("DELETE FROM HistoryFigures WHERE Id=@id AND UserId=@uid",
            [new("@id", id.ToString()), new("@uid", Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    // ─── Conversion endpoint ────────────────────────────────────────────

    [HttpGet("convert")]
    public IActionResult Convert([FromQuery] int year, [FromQuery] string type = "gregorian")
    {
        if (type == "hijri")
            return Ok(new { hijriYear = year, gregorianYear = HijriToGregorian(year) });
        return Ok(new { gregorianYear = year, hijriYear = GregorianToHijri(year) });
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private async Task<List<Dictionary<string, object?>>> Query(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct);
            var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct))
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < r.FieldCount; i++)
                    row[ToCamel(r.GetName(i))] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        }
        finally { await conn.CloseAsync(); }
    }

    private async Task<int> Exec(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        }
        finally { await conn.CloseAsync(); }
    }

    static string ToCamel(string s) => string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
}

public class HistoryRecordReq
{
    public int Year { get; set; }
    public int? HijriYear { get; set; }
    public string? InputType { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Figure { get; set; }
    public string? Location { get; set; }
    public string? Country { get; set; }
    public string? Category { get; set; }
    public string? StrategicImportance { get; set; }
    public string? Importance { get; set; }
    public string? Source { get; set; }
    public string? Tags { get; set; }
}

public class HistoryFigureReq
{
    public string? Name { get; set; }
    public int? BirthYear { get; set; }
    public int? DeathYear { get; set; }
    public string? Role { get; set; }
    public string? Nationality { get; set; }
    public string? Category { get; set; }
    public string? Bio { get; set; }
}
