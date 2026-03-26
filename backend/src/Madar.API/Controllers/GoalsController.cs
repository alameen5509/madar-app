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

        return Ok(goals);
    }

    /// <summary>إنشاء هدف / مشروع جديد</summary>
    [HttpPost]
    public async Task<IActionResult> CreateGoal(
        [FromBody] CreateGoalRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var circleId = req.LifeCircleId;
        if (circleId == null || circleId == Guid.Empty)
        {
            circleId = await _db.LifeCircles
                .Where(c => c.OwnerId == userId && c.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .Select(c => c.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (circleId == null || circleId == Guid.Empty)
            return BadRequest(new { error = "لا توجد دوائر حياة." });

        var goal = new Goal
        {
            Id             = Guid.NewGuid(),
            OwnerId        = userId,
            LifeCircleId   = circleId.Value,
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
