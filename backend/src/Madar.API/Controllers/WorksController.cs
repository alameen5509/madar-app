using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/works")]
public class WorksController : ControllerBase
{
    private readonly MadarDbContext _db;
    public WorksController(MadarDbContext db) => _db = db;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

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
        return Ok(new { w.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var w = await _db.Works.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (w is null) return NotFound();
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
        return Ok(new { j.Id, j.Title, j.WorkId });
    }

    [HttpPut("{workId:guid}/jobs/{jobId:guid}")]
    public async Task<IActionResult> UpdateJob(Guid workId, Guid jobId, [FromBody] CreateWorkJobReq req, CancellationToken ct)
    {
        var j = await _db.WorkJobs.FirstOrDefaultAsync(x => x.Id == jobId && x.WorkId == workId, ct);
        if (j is null) return NotFound();
        if (req.Title != null) j.Title = req.Title;
        if (req.Description != null) j.Description = req.Description;
        if (req.Salary.HasValue) j.Salary = req.Salary.Value;
        if (req.Status != null) j.Status = req.Status;
        if (DateTime.TryParse(req.StartDate, out var sd)) j.StartDate = sd;
        if (DateTime.TryParse(req.EndDate, out var ed)) j.EndDate = ed;
        await _db.SaveChangesAsync(ct);
        return Ok(new { j.Id });
    }

    [HttpDelete("{workId:guid}/jobs/{jobId:guid}")]
    public async Task<IActionResult> DeleteJob(Guid workId, Guid jobId, CancellationToken ct)
    {
        var j = await _db.WorkJobs.FirstOrDefaultAsync(x => x.Id == jobId && x.WorkId == workId, ct);
        if (j is null) return NotFound();
        _db.WorkJobs.Remove(j);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record CreateWorkReq(string Name, string? Type = "job", string? Title = null, string? Employer = null, decimal? Salary = null, string? StartDate = null, string? EndDate = null, string? Status = null, string? Sector = null, string? Role = null, decimal? OwnershipPercentage = null);
public record CreateWorkJobReq(string Title, string? Description = null, decimal? Salary = null, string? Status = null, string? StartDate = null, string? EndDate = null);
