using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class GoalsController : BaseController
{
    private readonly MadarDbContext _db;
    public GoalsController(MadarDbContext db) => _db = db;

    /// <summary>قائمة أهداف المستخدم مرتبةً بالموعد النهائي</summary>
    [HttpGet]
    public async Task<IActionResult> GetGoals(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Auto-unsuspend expired suspensions
        var expired = await _db.Goals
            .Where(g => g.OwnerId == userId && g.Status == GoalStatus.Suspended
                        && g.SuspendedUntil != null && g.SuspendedUntil <= DateTime.UtcNow)
            .ToListAsync(ct);
        if (expired.Count > 0)
        {
            foreach (var g in expired) { g.Status = GoalStatus.Active; g.SuspendedUntil = null; g.SuspendReason = null; }
            await _db.SaveChangesAsync(ct);
        }

        var goals = await _db.Goals
            .Include(g => g.LifeCircle)
            .Include(g => g.LinkedTasks)
            .Where(g => g.OwnerId == userId)
            .OrderBy(g => g.TargetDate)
            .Select(g => new
            {
                id              = g.Id,
                title           = g.Title,
                description     = g.Description,
                status          = g.Status.ToString(),
                targetDate      = g.TargetDate,
                priorityWeight  = g.PriorityWeight,
                focusType       = g.FocusType,
                suspendedUntil  = g.SuspendedUntil,
                suspendReason   = g.SuspendReason,
                progressPercent = g.LinkedTasks.Count == 0
                    ? 0
                    : (int)Math.Round(
                        (double)g.LinkedTasks.Count(t => t.Status == Madar.Domain.Enums.TaskStatus.Completed)
                        / g.LinkedTasks.Count * 100),
                lifeCircle = g.LifeCircle == null ? null : new
                {
                    id    = g.LifeCircle.Id,
                    name  = g.LifeCircle.Name,
                    color = g.LifeCircle.ColorHex ?? "#5E5495"
                }
            })
            .ToListAsync(ct);

        // Enrich with workId (raw SQL column) and source (job/role/manual)
        var goalIds = goals.Select(g => g.id).ToList();
        var jobLinked = new HashSet<Guid>(await _db.JobGoalProjects.Where(p => goalIds.Contains(p.ProjectId)).Select(p => p.ProjectId).ToListAsync(ct));
        var roleLinked = new HashSet<Guid>(await _db.RoleGoalProjects.Where(p => goalIds.Contains(p.ProjectId)).Select(p => p.ProjectId).ToListAsync(ct));

        // Read WorkId from raw SQL
        var workIds = new Dictionary<string, string>();
        try
        {
            var conn = _db.Database.GetDbConnection();
            var wasOpen = conn.State == System.Data.ConnectionState.Open;
            if (!wasOpen) await conn.OpenAsync(ct);
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"SELECT Id, WorkId FROM Goals WHERE OwnerId='{userId}' AND WorkId IS NOT NULL";
                using var r = await cmd.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct))
                    workIds[r.GetString(0)] = r.IsDBNull(1) ? "" : r.GetString(1);
            }
            finally { if (!wasOpen) await conn.CloseAsync(); }
        } catch {}

        var enriched = goals.Select(g => new
        {
            g.id, g.title, g.description, g.status, g.targetDate, g.priorityWeight,
            g.focusType, g.suspendedUntil, g.suspendReason, g.progressPercent, g.lifeCircle,
            workId = workIds.TryGetValue(g.id.ToString(), out var wid) ? wid : null,
            source = jobLinked.Contains(g.id) ? "job" : roleLinked.Contains(g.id) ? "role" : "manual",
        });

        return Ok(enriched);
    }

    /// <summary>إنشاء هدف / مشروع جديد</summary>
    [HttpPost]
    public async Task<IActionResult> CreateGoal(
        [FromBody] CreateGoalRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // LifeCircleId only if user explicitly sent one
        Guid? circleId = (req.LifeCircleId.HasValue && req.LifeCircleId.Value != Guid.Empty)
            ? req.LifeCircleId.Value
            : null;

        var goal = new Goal
        {
            Id             = Guid.NewGuid(),
            OwnerId        = userId,
            LifeCircleId   = circleId,
            Title          = req.Title,
            Description    = req.Description,
            TargetDate     = req.TargetDate,
            PriorityWeight = req.PriorityWeight ?? 5,
            Status         = GoalStatus.Active,
        };

        _db.Goals.Add(goal);
        await _db.SaveChangesAsync(ct);

        // Set WorkId via raw SQL (column added dynamically, not in EF model)
        if (req.WorkId.HasValue && req.WorkId.Value != Guid.Empty)
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Goals SET WorkId = @p0 WHERE Id = @p1",
                [req.WorkId.Value.ToString(), goal.Id.ToString()]);
        }

        await _db.Entry(goal).Reference(g => g.LifeCircle).LoadAsync(ct);

        return Ok(new
        {
            id              = goal.Id,
            title           = goal.Title,
            description     = goal.Description,
            status          = goal.Status.ToString(),
            targetDate      = goal.TargetDate,
            priorityWeight  = goal.PriorityWeight,
            focusType       = goal.FocusType,
            progressPercent = 0,
            lifeCircle = goal.LifeCircle == null ? null : new
            {
                id    = goal.LifeCircle.Id,
                name  = goal.LifeCircle.Name,
                color = goal.LifeCircle.ColorHex ?? "#5E5495"
            }
        });
    }
    /// <summary>تعديل هدف / مشروع</summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateGoal(
        Guid id,
        [FromBody] UpdateGoalRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var goal = await _db.Goals
            .Include(g => g.LifeCircle)
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);

        if (goal is null) return NotFound();

        if (req.Title is not null) goal.Title = req.Title;
        if (req.Description is not null) goal.Description = req.Description;
        if (req.TargetDate.HasValue) goal.TargetDate = req.TargetDate.Value;
        if (req.PriorityWeight.HasValue) goal.PriorityWeight = req.PriorityWeight.Value;
        if (req.Status is not null && Enum.TryParse<GoalStatus>(req.Status, out var status))
            goal.Status = status;
        if (req.LifeCircleId.HasValue && req.LifeCircleId.Value != Guid.Empty)
            goal.LifeCircleId = req.LifeCircleId.Value;

        await _db.SaveChangesAsync(ct);

        // Set WorkId via raw SQL
        if (req.WorkId.HasValue)
        {
            var wid = req.WorkId.Value == Guid.Empty ? (object)DBNull.Value : req.WorkId.Value.ToString();
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Goals SET WorkId = @p0 WHERE Id = @p1",
                [wid, goal.Id.ToString()]);
        }

        await _db.Entry(goal).Reference(g => g.LifeCircle).LoadAsync(ct);

        return Ok(new
        {
            id              = goal.Id,
            title           = goal.Title,
            description     = goal.Description,
            status          = goal.Status.ToString(),
            targetDate      = goal.TargetDate,
            priorityWeight  = goal.PriorityWeight,
            focusType       = goal.FocusType,
            lifeCircle = goal.LifeCircle == null ? null : new
            {
                id    = goal.LifeCircle.Id,
                name  = goal.LifeCircle.Name,
                color = goal.LifeCircle.ColorHex ?? "#5E5495"
            }
        });
    }

    /// <summary>تعيين / إلغاء تركيز مشروع (Tech أو NonTech — واحد من كل نوع)</summary>
    [HttpPost("{id:guid}/focus")]
    public async Task<IActionResult> SetFocus(
        Guid id,
        [FromBody] SetFocusRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var focusType = req.FocusType;   // "Tech" | "NonTech" | null (to clear)

        var goal = await _db.Goals
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (goal is null) return NotFound();

        // If clearing focus
        if (string.IsNullOrEmpty(focusType))
        {
            goal.FocusType = null;
            await _db.SaveChangesAsync(ct);
            return Ok(new { id = goal.Id, focusType = (string?)null });
        }

        // Validate type
        if (focusType != "Tech" && focusType != "NonTech")
            return BadRequest(new { error = "focusType must be Tech or NonTech" });

        // Remove same focusType from any other goal of this user
        var existing = await _db.Goals
            .Where(g => g.OwnerId == userId && g.FocusType == focusType && g.Id != id)
            .ToListAsync(ct);
        foreach (var g in existing) g.FocusType = null;

        // Toggle: if same goal already has this type → clear it, otherwise set
        if (goal.FocusType == focusType)
            goal.FocusType = null;
        else
            goal.FocusType = focusType;

        await _db.SaveChangesAsync(ct);

        return Ok(new { id = goal.Id, focusType = goal.FocusType });
    }

    /// <summary>تعليق مشروع</summary>
    [HttpPatch("{id:guid}/suspend")]
    public async Task<IActionResult> Suspend(Guid id, [FromBody] SuspendRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (goal is null) return NotFound();
        goal.Status = GoalStatus.Suspended;
        goal.SuspendedUntil = req.SuspendedUntil;
        goal.SuspendReason = req.Reason;
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = goal.Id, status = "Suspended", goal.SuspendedUntil, goal.SuspendReason });
    }

    /// <summary>رفع التعليق</summary>
    [HttpPatch("{id:guid}/unsuspend")]
    public async Task<IActionResult> Unsuspend(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (goal is null) return NotFound();
        goal.Status = GoalStatus.Active;
        goal.SuspendedUntil = null;
        goal.SuspendReason = null;
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = goal.Id, status = "Active" });
    }

    /// <summary>حذف هدف / مشروع</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var goal = await _db.Goals
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);

        if (goal is null) return NotFound();

        _db.Goals.Remove(goal);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "تم حذف المشروع" });
    }

    /// <summary>مهام مشروع / هدف محدد</summary>
    [HttpGet("{id:guid}/tasks")]
    public async Task<IActionResult> GetGoalTasks(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var tasks = await _db.SmartTasks
            .Where(t => t.GoalId == id && t.OwnerId == userId)
            .OrderBy(t => t.UserPriority)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Title, t.Description,
                status = t.Status.ToString(),
                t.UserPriority, t.DueDate, t.CompletedAt, t.CreatedAt,
                t.Cost, t.CostCurrency,
                t.EstimatedDurationMinutes, t.ActualDurationMinutes,
                assignedTo = t.AssignedTo == null ? null : new { t.AssignedTo.Id, t.AssignedTo.FullName },
                lifeCircle = t.LifeCircle == null ? null : new { t.LifeCircle.Id, t.LifeCircle.Name },
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }
}

public class CreateGoalRequest
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateTime? TargetDate { get; set; }
    public int? PriorityWeight { get; set; } = 5;
    public Guid? LifeCircleId { get; set; }
    public Guid? WorkId { get; set; }
}

public class UpdateGoalRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public DateTime? TargetDate { get; set; }
    public int? PriorityWeight { get; set; }
    public string? Status { get; set; }
    public Guid? LifeCircleId { get; set; }
    public Guid? WorkId { get; set; }
}

public class SetFocusRequest
{
    public string? FocusType { get; set; }  // "Tech" | "NonTech" | null
}

public class SuspendRequest
{
    public DateTime? SuspendedUntil { get; set; }
    public string? Reason { get; set; }
}
