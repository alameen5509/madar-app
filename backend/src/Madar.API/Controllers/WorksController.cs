using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/works")]
public class WorksController : ControllerBase
{
    private readonly MadarDbContext _db;
    public WorksController(MadarDbContext db) => _db = db;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var works = await _db.Works
            .Where(w => w.OwnerId == UserId)
            .Include(w => w.Jobs)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new
            {
                w.Id, w.Type, w.Name, w.Title, w.Employer, w.Salary,
                startDate = w.StartDate, endDate = w.EndDate, w.Status,
                w.Sector, w.Role, w.OwnershipPercentage,
                jobCount = w.Jobs.Count,
                jobs = w.Jobs.OrderByDescending(j => j.CreatedAt).Select(j => new
                {
                    j.Id, j.Title, j.Description, j.Salary, j.Status,
                    startDate = j.StartDate, endDate = j.EndDate,
                }).ToList(),
            })
            .ToListAsync(ct);
        return Ok(works);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var w = await _db.Works
            .Include(x => x.Jobs)
            .FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (w is null) return NotFound();
        return Ok(new
        {
            w.Id, w.Type, w.Name, w.Title, w.Employer, w.Salary,
            startDate = w.StartDate, endDate = w.EndDate, w.Status,
            w.Sector, w.Role, w.OwnershipPercentage,
            jobs = w.Jobs.OrderByDescending(j => j.CreatedAt).Select(j => new
            {
                j.Id, j.Title, j.Description, j.Salary, j.Status,
                startDate = j.StartDate, endDate = j.EndDate,
            }).ToList(),
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkReq req, CancellationToken ct)
    {
        var w = new Work
        {
            Id = Guid.NewGuid(), OwnerId = UserId,
            Type = req.Type ?? "job", Name = req.Name,
            Title = req.Title, Employer = req.Employer,
            Salary = req.Salary ?? 0,
            StartDate = DateTime.TryParse(req.StartDate, out var sd) ? sd : null,
            EndDate = DateTime.TryParse(req.EndDate, out var ed) ? ed : null,
            Status = req.Status ?? "active",
            Sector = req.Sector, Role = req.Role,
            OwnershipPercentage = req.OwnershipPercentage ?? 0,
        };
        _db.Works.Add(w);
        await _db.SaveChangesAsync(ct);

        // إنشاء منصب تلقائي في غرفة القيادة
        await CreateLeadershipRole(
            w.Id.ToString(),
            w.Name,
            w.Employer ?? w.Sector,
            w.Type == "job" ? "💼" : "🏢",
            w.Type == "job" ? "#2D6B9E" : "#5E5495",
            ct);

        return Ok(new { w.Id, w.Type, w.Name });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateWorkReq req, CancellationToken ct)
    {
        var w = await _db.Works.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (w is null) return NotFound();
        if (req.Name != null) w.Name = req.Name;
        if (req.Title != null) w.Title = req.Title;
        if (req.Employer != null) w.Employer = req.Employer;
        if (req.Salary.HasValue) w.Salary = req.Salary.Value;
        if (req.Status != null) w.Status = req.Status;
        if (req.Sector != null) w.Sector = req.Sector;
        if (req.Role != null) w.Role = req.Role;
        if (req.OwnershipPercentage.HasValue) w.OwnershipPercentage = req.OwnershipPercentage.Value;
        if (DateTime.TryParse(req.StartDate, out var sd)) w.StartDate = sd;
        if (DateTime.TryParse(req.EndDate, out var ed)) w.EndDate = ed;
        await _db.SaveChangesAsync(ct);

        // تحديث المنصب المرتبط في غرفة القيادة
        await SyncRoleTitle(w.Id.ToString(), w.Name, w.Employer ?? w.Sector, ct);

        return Ok(new { w.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var w = await _db.Works.Include(x => x.Jobs).FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (w is null) return NotFound();

        // حذف المناصب المرتبطة من غرفة القيادة (العمل + الوظائف التابعة)
        foreach (var j in w.Jobs)
            await DeleteLeadershipRole(j.Id.ToString(), ct);
        await DeleteLeadershipRole(w.Id.ToString(), ct);

        _db.Works.Remove(w);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══ Work Jobs (under entrepreneur) ═══

    [HttpPost("{workId:guid}/jobs")]
    public async Task<IActionResult> CreateJob(Guid workId, [FromBody] CreateWorkJobReq req, CancellationToken ct)
    {
        var w = await _db.Works.FirstOrDefaultAsync(x => x.Id == workId && x.OwnerId == UserId, ct);
        if (w is null) return NotFound();
        var j = new WorkJob
        {
            Id = Guid.NewGuid(), WorkId = workId, Title = req.Title,
            Description = req.Description, Salary = req.Salary ?? 0,
            Status = req.Status ?? "active",
            StartDate = DateTime.TryParse(req.StartDate, out var sd) ? sd : null,
            EndDate = DateTime.TryParse(req.EndDate, out var ed) ? ed : null,
        };
        _db.WorkJobs.Add(j);
        await _db.SaveChangesAsync(ct);

        // إنشاء منصب تلقائي في غرفة القيادة (WorkId = jobId for correct linkage)
        await CreateLeadershipRole(
            j.Id.ToString(),
            $"{req.Title} — {w.Name}",
            w.Sector,
            "👔",
            "#D4AF37",
            ct);

        return Ok(new { j.Id, j.Title, j.WorkId });
    }

    [HttpPut("{workId:guid}/jobs/{jobId:guid}")]
    public async Task<IActionResult> UpdateJob(Guid workId, Guid jobId, [FromBody] CreateWorkJobReq req, CancellationToken ct)
    {
        var j = await _db.WorkJobs.Include(x => x.Work).FirstOrDefaultAsync(x => x.Id == jobId && x.WorkId == workId, ct);
        if (j is null) return NotFound();
        if (req.Title != null) j.Title = req.Title;
        if (req.Description != null) j.Description = req.Description;
        if (req.Salary.HasValue) j.Salary = req.Salary.Value;
        if (req.Status != null) j.Status = req.Status;
        if (DateTime.TryParse(req.StartDate, out var sd)) j.StartDate = sd;
        if (DateTime.TryParse(req.EndDate, out var ed)) j.EndDate = ed;
        await _db.SaveChangesAsync(ct);

        // تحديث المنصب
        await SyncRoleTitle(j.Id.ToString(), $"{j.Title} — {j.Work.Name}", j.Work.Sector, ct);

        return Ok(new { j.Id });
    }

    [HttpDelete("{workId:guid}/jobs/{jobId:guid}")]
    public async Task<IActionResult> DeleteJob(Guid workId, Guid jobId, CancellationToken ct)
    {
        var j = await _db.WorkJobs.FirstOrDefaultAsync(x => x.Id == jobId && x.WorkId == workId, ct);
        if (j is null) return NotFound();

        await DeleteLeadershipRole(j.Id.ToString(), ct);

        _db.WorkJobs.Remove(j);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══ غرفة القيادة — مزامنة تلقائية ═══

    private async Task CreateLeadershipRole(string sourceId, string title, string? org, string icon, string color, CancellationToken ct, string? workId = null)
    {
        // تأكد من وجود عمود SourceId
        try { await Exec("ALTER TABLE LeadershipRoles ADD COLUMN SourceId VARCHAR(36) NULL", [], ct); } catch { /* already exists */ }

        // تحقق هل المنصب موجود بالفعل
        var existing = await Query("SELECT Id FROM LeadershipRoles WHERE SourceId=@sid AND UserId=@uid LIMIT 1", [P("@sid", sourceId), P("@uid", Uid)], ct);
        if (existing.Count > 0)
        {
            await Exec("UPDATE LeadershipRoles SET Title=@t, Organization=@org, Icon=@ic, Color=@c WHERE SourceId=@sid AND UserId=@uid",
                [P("@t", title), P("@org", org), P("@ic", icon), P("@c", color), P("@sid", sourceId), P("@uid", Uid)], ct);
            return;
        }

        var roleId = Guid.NewGuid().ToString();
        var wid = workId ?? sourceId;
        await Exec(@"INSERT INTO LeadershipRoles (Id,UserId,Title,Organization,WorkId,ReviewFrequency,Color,Icon,Priority,PulseStatus,IsActive,SourceId)
            VALUES(@id,@uid,@t,@org,@wid,'weekly',@c,@ic,0,'green',1,@sid)",
            [P("@id", roleId), P("@uid", Uid), P("@t", title), P("@org", org), P("@wid", wid), P("@c", color), P("@ic", icon), P("@sid", sourceId)], ct);
    }

    private async Task SyncRoleTitle(string sourceId, string title, string? org, CancellationToken ct)
    {
        await Exec("UPDATE LeadershipRoles SET Title=@t, Organization=@org WHERE SourceId=@sid AND UserId=@uid",
            [P("@t", title), P("@org", org), P("@sid", sourceId), P("@uid", Uid)], ct);
    }

    private async Task DeleteLeadershipRole(string sourceId, CancellationToken ct)
    {
        // حذف الملاحظات والطلبات أولاً
        var roleIds = await Query("SELECT Id FROM LeadershipRoles WHERE SourceId=@sid AND UserId=@uid", [P("@sid", sourceId), P("@uid", Uid)], ct);
        foreach (var row in roleIds)
        {
            var rid = row["id"]?.ToString();
            if (rid == null) continue;
            await Exec("DELETE FROM LeadershipNotes WHERE RoleId=@rid", [P("@rid", rid)], ct);
            await Exec("DELETE FROM LeadershipDevRequests WHERE RoleId=@rid", [P("@rid", rid)], ct);
        }
        await Exec("DELETE FROM LeadershipRoles WHERE SourceId=@sid AND UserId=@uid", [P("@sid", sourceId), P("@uid", Uid)], ct);
    }

    // ═══ Raw SQL helpers ═══
    static NpgsqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);

    private async Task<int> Exec(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        }
        finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    private async Task<List<Dictionary<string, object?>>> Query(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
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
                    row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        }
        finally { if (!wasOpen) await conn.CloseAsync(); }
    }
}

public class CreateWorkReq
{
    public string Name { get; set; } = "";
    public string? Type { get; set; } = "job";
    public string? Title { get; set; }
    public string? Employer { get; set; }
    public decimal? Salary { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? Status { get; set; }
    public string? Sector { get; set; }
    public string? Role { get; set; }
    public decimal? OwnershipPercentage { get; set; }
}

public class CreateWorkJobReq
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public decimal? Salary { get; set; }
    public string? Status { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
}
