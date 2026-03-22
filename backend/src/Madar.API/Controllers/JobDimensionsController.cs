using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

// ═══════════════════════════════════════════════════════════════════
//  POST /api/jobs/:id/dimensions — add root dimension to a job
// ═══════════════════════════════════════════════════════════════════

[Authorize]
[Route("api/jobs")]
public class JobsExtController : BaseController
{
    private readonly MadarDbContext _db;
    public JobsExtController(MadarDbContext db) => _db = db;

    [HttpPost("{jobId:guid}/dimensions")]
    public async Task<IActionResult> AddRootDimension(Guid jobId, [FromBody] AddDimensionBody req, CancellationToken ct)
    {
        var dim = new JobDimension
        {
            Id = Guid.NewGuid(), JobId = jobId,
            Name = req.Name, Icon = req.Icon, Color = req.Color,
            Priority = req.Priority,
        };
        _db.JobDimensions.Add(dim);
        await _db.SaveChangesAsync(ct);
        return Ok(new { dim.Id, dim.JobId, dim.Name, dim.Icon, dim.Color, dim.Priority, ParentDimensionId = (Guid?)null });
    }
}

// ═══════════════════════════════════════════════════════════════════
//  /api/job-dimensions
// ═══════════════════════════════════════════════════════════════════

[Authorize]
[Route("api/job-dimensions")]
public class JobDimensionsController : BaseController
{
    private readonly MadarDbContext _db;
    public JobDimensionsController(MadarDbContext db) => _db = db;

    // GET /api/job-dimensions/{jobId} — flat list
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

    // POST /api/job-dimensions/{id}/child — add sub-dimension
    [HttpPost("{parentId:guid}/child")]
    public async Task<IActionResult> AddChild(Guid parentId, [FromBody] AddDimensionBody req, CancellationToken ct)
    {
        var parent = await _db.JobDimensions.FirstOrDefaultAsync(d => d.Id == parentId, ct);
        if (parent is null) return NotFound();

        var dim = new JobDimension
        {
            Id = Guid.NewGuid(), JobId = parent.JobId,
            ParentDimensionId = parentId,
            Name = req.Name, Icon = req.Icon, Color = req.Color,
            Priority = req.Priority,
        };
        _db.JobDimensions.Add(dim);
        await _db.SaveChangesAsync(ct);
        return Ok(new { dim.Id, dim.JobId, dim.ParentDimensionId, dim.Name, dim.Icon, dim.Color, dim.Priority });
    }

    // GET /api/job-dimensions/{id}/tree — full tree (dimension + sub-dimensions + goals)
    [HttpGet("{id:guid}/tree")]
    public async Task<IActionResult> GetTree(Guid id, CancellationToken ct)
    {
        var dim = await _db.JobDimensions.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (dim is null) return NotFound();

        // all dimensions under this job
        var allDims = await _db.JobDimensions
            .Where(d => d.JobId == dim.JobId)
            .OrderBy(d => d.Priority)
            .Select(d => new DimDto(d.Id, d.ParentDimensionId, d.Name, d.Icon, d.Color, d.Priority))
            .ToListAsync(ct);

        // all goals under this job
        var allGoals = await _db.JobGoals
            .Where(g => g.JobId == dim.JobId)
            .OrderBy(g => g.Priority)
            .Select(g => new GoalDto(g.Id, g.DimensionId, g.ParentGoalId, g.Title, g.Description, g.Progress, g.Status, g.Priority, g.Timeframe, g.DueDate))
            .ToListAsync(ct);

        object BuildDimTree(Guid dimId)
        {
            var d = allDims.First(x => x.Id == dimId);
            var children = allDims.Where(x => x.ParentId == dimId).Select(x => BuildDimTree(x.Id)).ToList();
            var dimGoals = allGoals.Where(g => g.DimensionId == dimId && g.ParentGoalId == null)
                .Select(g => BuildGoalTree(g.Id)).ToList();
            return new { d.Id, d.Name, d.Icon, d.Color, d.Priority, children, goals = dimGoals };
        }

        object BuildGoalTree(Guid goalId)
        {
            var g = allGoals.First(x => x.Id == goalId);
            var subs = allGoals.Where(x => x.ParentGoalId == goalId).Select(x => BuildGoalTree(x.Id)).ToList();
            return new { g.Id, g.Title, g.Description, g.Progress, g.Status, g.Priority, g.Timeframe, g.DueDate, subGoals = subs };
        }

        return Ok(BuildDimTree(id));
    }

    // POST /api/job-dimensions/{id}/goal — add goal to dimension
    [HttpPost("{dimId:guid}/goal")]
    public async Task<IActionResult> AddGoal(Guid dimId, [FromBody] AddGoalBody req, CancellationToken ct)
    {
        var dim = await _db.JobDimensions.FirstOrDefaultAsync(d => d.Id == dimId, ct);
        if (dim is null) return NotFound();

        var goal = new JobGoal
        {
            Id = Guid.NewGuid(), JobId = dim.JobId, DimensionId = dimId,
            Title = req.Title, Description = req.Description,
            DueDate = req.DueDate, Priority = req.Priority,
            Timeframe = req.Timeframe,
        };
        _db.JobGoals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return Ok(new { goal.Id, goal.JobId, goal.DimensionId, goal.Title, goal.Priority, goal.Timeframe, ParentGoalId = (Guid?)null });
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

// ═══════════════════════════════════════════════════════════════════
//  /api/job-goals
// ═══════════════════════════════════════════════════════════════════

[Authorize]
[Route("api/job-goals")]
public class JobGoalsController : BaseController
{
    private readonly MadarDbContext _db;
    public JobGoalsController(MadarDbContext db) => _db = db;

    // GET /api/job-goals/{jobId} — flat list with linked project/task IDs
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

    // POST /api/job-goals/{id}/subgoal — add sub-goal
    [HttpPost("{parentId:guid}/subgoal")]
    public async Task<IActionResult> AddSubGoal(Guid parentId, [FromBody] AddGoalBody req, CancellationToken ct)
    {
        var parent = await _db.JobGoals.FirstOrDefaultAsync(g => g.Id == parentId, ct);
        if (parent is null) return NotFound();

        var goal = new JobGoal
        {
            Id = Guid.NewGuid(), JobId = parent.JobId, DimensionId = parent.DimensionId,
            ParentGoalId = parentId,
            Title = req.Title, Description = req.Description,
            DueDate = req.DueDate, Priority = req.Priority,
            Timeframe = req.Timeframe,
        };
        _db.JobGoals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return Ok(new { goal.Id, goal.JobId, goal.DimensionId, goal.ParentGoalId, goal.Title, goal.Priority, goal.Timeframe });
    }

    // GET /api/job-goals/{id}/tree — goal tree (goal + sub-goals recursively)
    [HttpGet("{id:guid}/tree")]
    public async Task<IActionResult> GetGoalTree(Guid id, CancellationToken ct)
    {
        var root = await _db.JobGoals.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (root is null) return NotFound();

        var allGoals = await _db.JobGoals
            .Where(g => g.JobId == root.JobId && g.DimensionId == root.DimensionId)
            .OrderBy(g => g.Priority)
            .Select(g => new
            {
                g.Id, g.ParentGoalId, g.Title, g.Description, g.Progress,
                g.Status, g.Priority, g.Timeframe, g.DueDate,
                projects = g.Projects.Select(p => p.ProjectId).ToList(),
                tasks = g.Tasks.Select(t => t.TaskId).ToList(),
            })
            .ToListAsync(ct);

        object Build(Guid gid)
        {
            var g = allGoals.First(x => x.Id == gid);
            var subs = allGoals.Where(x => x.ParentGoalId == gid).Select(x => Build(x.Id)).ToList();
            return new { g.Id, g.Title, g.Description, g.Progress, g.Status, g.Priority, g.Timeframe, g.DueDate, g.projects, g.tasks, subGoals = subs };
        }

        return Ok(Build(id));
    }

    // POST /api/job-goals/{id}/link-project — link project
    [HttpPost("{goalId:guid}/link-project")]
    public async Task<IActionResult> LinkProject(Guid goalId, [FromBody] LinkIdBody req, CancellationToken ct)
    {
        var exists = await _db.JobGoalProjects.AnyAsync(x => x.GoalId == goalId && x.ProjectId == req.Id, ct);
        if (!exists)
        {
            _db.JobGoalProjects.Add(new JobGoalProject { Id = Guid.NewGuid(), GoalId = goalId, ProjectId = req.Id });
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { success = true });
    }

    // POST /api/job-goals/{id}/link-task — link task
    [HttpPost("{goalId:guid}/link-task")]
    public async Task<IActionResult> LinkTask(Guid goalId, [FromBody] LinkIdBody req, CancellationToken ct)
    {
        var exists = await _db.JobGoalTasks.AnyAsync(x => x.GoalId == goalId && x.TaskId == req.Id, ct);
        if (!exists)
        {
            _db.JobGoalTasks.Add(new JobGoalTask { Id = Guid.NewGuid(), GoalId = goalId, TaskId = req.Id });
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { success = true });
    }

    // Keep old-style unlink
    [HttpDelete("{goalId:guid}/projects/{projectId:guid}")]
    public async Task<IActionResult> UnlinkProject(Guid goalId, Guid projectId, CancellationToken ct)
    {
        var link = await _db.JobGoalProjects.FirstOrDefaultAsync(x => x.GoalId == goalId && x.ProjectId == projectId, ct);
        if (link != null) { _db.JobGoalProjects.Remove(link); await _db.SaveChangesAsync(ct); }
        return NoContent();
    }

    [HttpDelete("{goalId:guid}/tasks/{taskId:guid}")]
    public async Task<IActionResult> UnlinkTask(Guid goalId, Guid taskId, CancellationToken ct)
    {
        var link = await _db.JobGoalTasks.FirstOrDefaultAsync(x => x.GoalId == goalId && x.TaskId == taskId, ct);
        if (link != null) { _db.JobGoalTasks.Remove(link); await _db.SaveChangesAsync(ct); }
        return NoContent();
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
}

// ─── DTOs ───
public record AddDimensionBody(string Name, string? Icon = null, string? Color = null, int Priority = 0);
public record AddGoalBody(string Title, string? Description = null, DateTime? DueDate = null, int Priority = 0, string? Timeframe = null);
public record LinkIdBody(Guid Id);

public record UpdateJobDimensionReq(string? Name = null, Guid? ParentDimensionId = null, string? Icon = null, string? Color = null, int? Priority = null);
public record UpdateJobGoalReq(string? Title = null, string? Description = null, DateTime? DueDate = null, int? Progress = null, string? Status = null, int? Priority = null, string? Timeframe = null);

// Internal DTOs for tree building
internal record DimDto(Guid Id, Guid? ParentId, string Name, string? Icon, string? Color, int Priority);
internal record GoalDto(Guid Id, Guid DimensionId, Guid? ParentGoalId, string Title, string? Description, int Progress, string Status, int Priority, string? Timeframe, DateTime? DueDate);
