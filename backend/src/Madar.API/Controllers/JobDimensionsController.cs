using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[Route("api/job-dimensions")]
public class JobDimensionsController : BaseController
{
    private readonly MadarDbContext _db;
    public JobDimensionsController(MadarDbContext db) => _db = db;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ─── Dimensions CRUD ───

    [HttpGet("{jobId:guid}")]
    public async Task<IActionResult> GetDimensions(Guid jobId, CancellationToken ct)
    {
        var dims = await _db.JobDimensions
            .Where(d => d.JobId == jobId)
            .OrderBy(d => d.Priority)
            .Select(d => new { d.Id, d.JobId, d.ParentDimensionId, d.Name, d.Icon, d.Color, d.Priority })
            .ToListAsync(ct);
        return Ok(dims);
    }

    [HttpPost]
    public async Task<IActionResult> CreateDimension([FromBody] CreateJobDimensionReq req, CancellationToken ct)
    {
        var dim = new JobDimension
        {
            Id = Guid.NewGuid(), JobId = req.JobId,
            ParentDimensionId = req.ParentDimensionId,
            Name = req.Name, Icon = req.Icon, Color = req.Color,
            Priority = req.Priority,
        };
        _db.JobDimensions.Add(dim);
        await _db.SaveChangesAsync(ct);
        return Ok(new { dim.Id, dim.JobId, dim.ParentDimensionId, dim.Name, dim.Icon, dim.Color, dim.Priority });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateDimension(Guid id, [FromBody] UpdateJobDimensionReq req, CancellationToken ct)
    {
        var dim = await _db.JobDimensions.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (dim is null) return NotFound();
        dim.Name = req.Name ?? dim.Name;
        dim.Icon = req.Icon ?? dim.Icon;
        dim.Color = req.Color ?? dim.Color;
        dim.Priority = req.Priority ?? dim.Priority;
        dim.ParentDimensionId = req.ParentDimensionId;
        await _db.SaveChangesAsync(ct);
        return Ok(new { dim.Id, dim.Name, dim.Icon, dim.Color, dim.Priority, dim.ParentDimensionId });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteDimension(Guid id, CancellationToken ct)
    {
        var dim = await _db.JobDimensions.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (dim is null) return NotFound();
        _db.JobDimensions.Remove(dim);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ─── Goals Controller ───

[Authorize]
[Route("api/job-goals")]
public class JobGoalsController : BaseController
{
    private readonly MadarDbContext _db;
    public JobGoalsController(MadarDbContext db) => _db = db;

    [HttpGet("{jobId:guid}")]
    public async Task<IActionResult> GetGoals(Guid jobId, CancellationToken ct)
    {
        var goals = await _db.JobGoals
            .Where(g => g.JobId == jobId)
            .OrderBy(g => g.Priority)
            .Select(g => new
            {
                g.Id, g.JobId, g.DimensionId, g.ParentGoalId,
                g.Title, g.Description, g.DueDate, g.Progress,
                g.Status, g.Priority, g.Timeframe,
                projects = g.Projects.Select(p => p.ProjectId).ToList(),
                tasks = g.Tasks.Select(t => t.TaskId).ToList(),
            })
            .ToListAsync(ct);
        return Ok(goals);
    }

    [HttpPost]
    public async Task<IActionResult> CreateGoal([FromBody] CreateJobGoalReq req, CancellationToken ct)
    {
        var goal = new JobGoal
        {
            Id = Guid.NewGuid(), JobId = req.JobId, DimensionId = req.DimensionId,
            ParentGoalId = req.ParentGoalId,
            Title = req.Title, Description = req.Description,
            DueDate = req.DueDate, Priority = req.Priority,
            Timeframe = req.Timeframe,
        };
        _db.JobGoals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return Ok(new { goal.Id, goal.Title, goal.DimensionId, goal.ParentGoalId, goal.Priority, goal.Timeframe });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateGoal(Guid id, [FromBody] UpdateJobGoalReq req, CancellationToken ct)
    {
        var goal = await _db.JobGoals.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (goal is null) return NotFound();
        if (req.Title != null) goal.Title = req.Title;
        if (req.Description != null) goal.Description = req.Description;
        if (req.DueDate.HasValue) goal.DueDate = req.DueDate;
        if (req.Progress.HasValue) goal.Progress = req.Progress.Value;
        if (req.Status != null) goal.Status = req.Status;
        if (req.Priority.HasValue) goal.Priority = req.Priority.Value;
        if (req.Timeframe != null) goal.Timeframe = req.Timeframe;
        await _db.SaveChangesAsync(ct);
        return Ok(new { goal.Id, goal.Title, goal.Progress, goal.Status });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, CancellationToken ct)
    {
        var goal = await _db.JobGoals.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (goal is null) return NotFound();
        _db.JobGoals.Remove(goal);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── Link/Unlink projects & tasks ───

    [HttpPost("{goalId:guid}/projects/{projectId:guid}")]
    public async Task<IActionResult> LinkProject(Guid goalId, Guid projectId, CancellationToken ct)
    {
        var exists = await _db.JobGoalProjects.AnyAsync(x => x.GoalId == goalId && x.ProjectId == projectId, ct);
        if (!exists)
        {
            _db.JobGoalProjects.Add(new JobGoalProject { Id = Guid.NewGuid(), GoalId = goalId, ProjectId = projectId });
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { success = true });
    }

    [HttpDelete("{goalId:guid}/projects/{projectId:guid}")]
    public async Task<IActionResult> UnlinkProject(Guid goalId, Guid projectId, CancellationToken ct)
    {
        var link = await _db.JobGoalProjects.FirstOrDefaultAsync(x => x.GoalId == goalId && x.ProjectId == projectId, ct);
        if (link != null) { _db.JobGoalProjects.Remove(link); await _db.SaveChangesAsync(ct); }
        return NoContent();
    }

    [HttpPost("{goalId:guid}/tasks/{taskId:guid}")]
    public async Task<IActionResult> LinkTask(Guid goalId, Guid taskId, CancellationToken ct)
    {
        var exists = await _db.JobGoalTasks.AnyAsync(x => x.GoalId == goalId && x.TaskId == taskId, ct);
        if (!exists)
        {
            _db.JobGoalTasks.Add(new JobGoalTask { Id = Guid.NewGuid(), GoalId = goalId, TaskId = taskId });
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { success = true });
    }

    [HttpDelete("{goalId:guid}/tasks/{taskId:guid}")]
    public async Task<IActionResult> UnlinkTask(Guid goalId, Guid taskId, CancellationToken ct)
    {
        var link = await _db.JobGoalTasks.FirstOrDefaultAsync(x => x.GoalId == goalId && x.TaskId == taskId, ct);
        if (link != null) { _db.JobGoalTasks.Remove(link); await _db.SaveChangesAsync(ct); }
        return NoContent();
    }
}

// ─── Request DTOs ───
public record CreateJobDimensionReq(Guid JobId, string Name, Guid? ParentDimensionId = null, string? Icon = null, string? Color = null, int Priority = 0);
public record UpdateJobDimensionReq(string? Name = null, Guid? ParentDimensionId = null, string? Icon = null, string? Color = null, int? Priority = null);
public record CreateJobGoalReq(Guid JobId, Guid DimensionId, string Title, Guid? ParentGoalId = null, string? Description = null, DateTime? DueDate = null, int Priority = 0, string? Timeframe = null);
public record UpdateJobGoalReq(string? Title = null, string? Description = null, DateTime? DueDate = null, int? Progress = null, string? Status = null, int? Priority = null, string? Timeframe = null);
