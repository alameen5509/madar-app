using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public ProjectsController(MadarDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetProjects(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var projects = await _db.Projects
            .Where(p => p.OwnerId == userId)
            .Include(p => p.Tasks)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id, p.Title, p.Description, p.Budget, p.Currency, p.CreatedAt,
                taskCount = p.Tasks.Count,
                totalCost = p.Tasks.Sum(t => t.Cost ?? 0),
            })
            .ToListAsync(ct);

        return Ok(projects);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerId = userId,
            Title = req.Title,
            Description = req.Description,
            Budget = req.Budget ?? 0,
            Currency = req.Currency ?? "SAR",
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);
        return Ok(new { project.Id, project.Title, project.Budget, project.Currency });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetProject(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var project = await _db.Projects
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == userId, ct);

        if (project is null) return NotFound();

        return Ok(new
        {
            project.Id, project.Title, project.Description, project.Budget, project.Currency, project.CreatedAt,
            taskCount = project.Tasks.Count,
            totalCost = project.Tasks.Sum(t => t.Cost ?? 0),
            tasks = project.Tasks.Select(t => new { t.Id, t.Title, status = t.Status.ToString(), t.Cost, t.CostCurrency }),
        });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateProject(Guid id, [FromBody] UpdateProjectRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == userId, ct);
        if (project is null) return NotFound();

        if (req.Title is not null) project.Title = req.Title;
        if (req.Description is not null) project.Description = req.Description;
        if (req.Budget.HasValue) project.Budget = req.Budget.Value;
        if (req.Currency is not null) project.Currency = req.Currency;
        project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم التحديث" });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProject(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == userId, ct);
        if (project is null) return NotFound();

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }
}

public class CreateProjectRequest
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public decimal? Budget { get; set; }
    public string? Currency { get; set; }
}

public class UpdateProjectRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public decimal? Budget { get; set; }
    public string? Currency { get; set; }
}
