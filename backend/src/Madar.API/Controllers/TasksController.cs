using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class TasksController : BaseController
{
    private readonly MadarDbContext _db;
    public TasksController(MadarDbContext db) => _db = db;

    /// <summary>قائمة مهام المستخدم الحالي مرتبةً بأولوية الذكاء الاصطناعي</summary>
    [HttpGet]
    public async Task<IActionResult> GetTasks(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var tasks = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .Include(t => t.Goal)
            .Include(t => t.AssignedTo)
            .Where(t => t.OwnerId == userId && t.Status != Madar.Domain.Enums.TaskStatus.Cancelled)
            .OrderByDescending(t => t.AiPriorityScore)
            .ThenByDescending(t => t.UserPriority)
            .ThenBy(t => t.CreatedAt)
            .Select(t => new
            {
                id             = t.Id,
                title          = t.Title,
                description    = t.Description,
                status         = t.Status.ToString(),
                userPriority   = t.UserPriority,
                aiPriorityScore = t.AiPriorityScore,
                cognitiveLoad  = t.RequiredCognitiveLoad.ToString(),
                dueDate        = t.DueDate,
                isRecurring    = t.IsRecurring,
                recurrenceRule = t.RecurrenceRule,
                contextNote    = t.ContextNote,
                estimatedDurationMinutes = t.EstimatedDurationMinutes,
                actualDurationMinutes    = t.ActualDurationMinutes,
                completedAt              = t.CompletedAt,
                createdAt                = t.CreatedAt,
                wasCompletedOnTime       = t.WasCompletedOnTime,
                cost             = t.Cost,
                costCurrency     = t.CostCurrency,
                assignedToId     = t.AssignedToId,
                projectId        = t.ProjectId,
                goal = t.Goal == null ? null : new { t.Goal.Id, t.Goal.Title },
                assignedTo = t.AssignedTo == null ? null : new { t.AssignedTo.Id, t.AssignedTo.FullName },
                lifeCircle     = t.LifeCircle == null ? null : new
                {
                    id    = t.LifeCircle.Id,
                    name  = t.LifeCircle.Name,
                    color = t.LifeCircle.ColorHex ?? "#5E5495",
                    icon  = t.LifeCircle.IconKey  ?? ""
                }
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }

    /// <summary>إنشاء مهمة جديدة</summary>
    [HttpPost]
    public async Task<IActionResult> CreateTask(
        [FromBody] CreateTaskRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // LifeCircleId only if user explicitly sent one
        Guid? circleId = (req.LifeCircleId.HasValue && req.LifeCircleId.Value != Guid.Empty)
            ? req.LifeCircleId.Value : null;

        var task = new SmartTask
        {
            Id                    = Guid.NewGuid(),
            OwnerId               = userId,
            LifeCircleId           = circleId,
            Title                  = req.Title,
            Description            = req.Description,
            UserPriority           = req.UserPriority ?? 3,
            RequiredCognitiveLoad  = req.CognitiveLoad ?? CognitiveLoad.Medium,
            DueDate                = req.DueDate,
            Status                 = Madar.Domain.Enums.TaskStatus.Todo,
            GoalId                 = req.GoalId,
            ParentTaskId           = req.ParentTaskId,
            IsRecurring            = req.IsRecurring ?? false,
            RecurrenceRule         = req.RecurrenceRule,
            ContextNote            = string.Join("|", new[] {
                req.IsWorkTask == true ? "work" : null,
                req.IsUrgent == true ? "urgent" : null,
                req.WaitingFor != null ? $"waiting:{req.WaitingFor}" : null,
                req.TaskContext != null ? $"ctx:{req.TaskContext}" : null,
                req.SuitablePeriod != null && req.SuitablePeriod != "all" ? $"period:{req.SuitablePeriod}" : null,
            }.Where(x => x != null)),
            Cost                   = req.Cost,
            CostCurrency           = req.CostCurrency ?? "SAR",
            AssignedToId           = req.AssignedToId,
            ProjectId              = req.ProjectId,
            CreatedAt              = DateTime.UtcNow,
            UpdatedAt              = DateTime.UtcNow,
        };

        _db.SmartTasks.Add(task);
        await _db.SaveChangesAsync(ct);

        // reload with circle for response
        await _db.Entry(task).Reference(t => t.LifeCircle).LoadAsync(ct);

        return Ok(new
        {
            id              = task.Id,
            title           = task.Title,
            description     = task.Description,
            status          = task.Status.ToString(),
            userPriority    = task.UserPriority,
            aiPriorityScore = task.AiPriorityScore,
            cognitiveLoad   = task.RequiredCognitiveLoad.ToString(),
            dueDate         = task.DueDate,
            contextNote     = task.ContextNote,
            isRecurring     = task.IsRecurring,
            recurrenceRule  = task.RecurrenceRule,
            createdAt       = task.CreatedAt,
            lifeCircle      = task.LifeCircle == null ? null : new
            {
                id    = task.LifeCircle.Id,
                name  = task.LifeCircle.Name,
                color = task.LifeCircle.ColorHex ?? "#5E5495",
                icon  = task.LifeCircle.IconKey  ?? ""
            }
        });
    }

    /// <summary>تغيير حالة مهمة (مثلاً إكمالها) مع تتبع المدة والتأجيلات</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateStatusRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task   = await _db.SmartTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);

        if (task is null) return NotFound();

        var oldStatus = task.Status;
        task.Status    = req.Status;
        task.UpdatedAt = DateTime.UtcNow;

        if (req.Status == Madar.Domain.Enums.TaskStatus.Completed)
        {
            task.CompletedAt = DateTime.UtcNow;
            task.WasCompletedOnTime = task.DueDate == null || DateTime.UtcNow <= task.DueDate;
            // حساب مدة الإنجاز من تاريخ الإنشاء
            task.ActualDurationMinutes = (int)(DateTime.UtcNow - task.CreatedAt).TotalMinutes;
        }

        // تتبع التأجيل
        if (req.Status == Madar.Domain.Enums.TaskStatus.Deferred && oldStatus != Madar.Domain.Enums.TaskStatus.Deferred)
        {
            // نخزّن عدد التأجيلات في ContextNote
            var note = task.ContextNote ?? "";
            var deferMatch = System.Text.RegularExpressions.Regex.Match(note, @"defers:(\d+)");
            var count = deferMatch.Success ? int.Parse(deferMatch.Groups[1].Value) + 1 : 1;
            task.ContextNote = deferMatch.Success
                ? System.Text.RegularExpressions.Regex.Replace(note, @"defers:\d+", $"defers:{count}")
                : (string.IsNullOrEmpty(note) ? $"defers:{count}" : $"{note}|defers:{count}");
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>تعديل بيانات المهمة</summary>
    [HttpPost("{id:guid}/update")]
    public async Task<IActionResult> UpdateTask(
        Guid id,
        [FromBody] UpdateTaskRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);
        if (task is null) return NotFound();

        if (req.Title is not null) task.Title = req.Title;
        if (req.Description is not null) task.Description = req.Description;
        if (req.UserPriority.HasValue) task.UserPriority = req.UserPriority.Value;
        if (req.LifeCircleId.HasValue && req.LifeCircleId.Value != Guid.Empty)
            task.LifeCircleId = req.LifeCircleId.Value;
        if (req.GoalId.HasValue)
            task.GoalId = req.GoalId.Value == Guid.Empty ? null : req.GoalId.Value;
        if (req.DueDate.HasValue) task.DueDate = req.DueDate.Value;
        if (req.Cost.HasValue) task.Cost = req.Cost.Value;
        if (req.TaskContext is not null)
        {
            var note = task.ContextNote ?? "";
            var ctxMatch = System.Text.RegularExpressions.Regex.Match(note, @"ctx:\w+");
            task.ContextNote = ctxMatch.Success
                ? System.Text.RegularExpressions.Regex.Replace(note, @"ctx:\w+", $"ctx:{req.TaskContext}")
                : (string.IsNullOrEmpty(note) ? $"ctx:{req.TaskContext}" : $"{note}|ctx:{req.TaskContext}");
        }
        if (req.SuitablePeriod is not null)
        {
            // إعادة بناء contextNote: أزل period القديم، أضف الجديد
            var parts = (task.ContextNote ?? "").Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => !p.StartsWith("period:")).ToList();
            if (req.SuitablePeriod != "all")
                parts.Add($"period:{req.SuitablePeriod}");
            task.ContextNote = string.Join("|", parts);
        }
        task.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new
        {
            id = task.Id, title = task.Title, description = task.Description,
            status = task.Status.ToString(), userPriority = task.UserPriority,
            cognitiveLoad = task.RequiredCognitiveLoad.ToString(),
            dueDate = task.DueDate, contextNote = task.ContextNote,
            lifeCircle = task.LifeCircle == null ? null : new { id = task.LifeCircle.Id, name = task.LifeCircle.Name, color = task.LifeCircle.ColorHex ?? "#5E5495" }
        });
    }

    /// <summary>المهام الفرعية لمهمة معينة</summary>
    [HttpGet("{id:guid}/subtasks")]
    public async Task<IActionResult> GetSubTasks(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var subs = await _db.SmartTasks
            .Where(t => t.ParentTaskId == id && t.OwnerId == userId)
            .OrderBy(t => t.UserPriority).ThenBy(t => t.CreatedAt)
            .Select(t => new { t.Id, t.Title, status = t.Status.ToString(), t.UserPriority })
            .ToListAsync(ct);
        return Ok(subs);
    }

    /// <summary>حذف مهمة نهائياً</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task = await _db.SmartTasks.FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);
        if (task is null) return NotFound();
        _db.SmartTasks.Remove(task);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    /// <summary>قبول أو رفض مهمة في صندوق الوارد</summary>
    [HttpPatch("{id:guid}/accept")]
    public async Task<IActionResult> AcceptOrReject(
        Guid id,
        [FromBody] AcceptRejectRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task = await _db.SmartTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);

        if (task is null) return NotFound();

        if (req.Accept)
        {
            task.Status = Madar.Domain.Enums.TaskStatus.Todo;
        }
        else
        {
            _db.SmartTasks.Remove(task);
        }

        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { accepted = req.Accept });
    }

    /// <summary>إضافة مهمة لشخص آخر عبر بريده</summary>
    [HttpPost("assign")]
    public async Task<IActionResult> AssignTask(
        [FromBody] AssignTaskRequest req,
        CancellationToken ct)
    {
        // Find target user by email
        var targetUser = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.TargetEmail, ct);

        if (targetUser is null)
            return NotFound(new { error = "لم يتم العثور على المستخدم بهذا البريد" });

        var circleId = await _db.LifeCircles
            .Where(c => c.OwnerId == targetUser.Id && c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        if (circleId == Guid.Empty)
            return BadRequest(new { error = "المستخدم المستهدف ليس لديه دوائر حياة" });

        var senderName = User.FindFirstValue(System.Security.Claims.ClaimTypes.Name) ?? "شخص";

        var task = new SmartTask
        {
            Id                    = Guid.NewGuid(),
            OwnerId               = targetUser.Id,
            LifeCircleId           = circleId,
            Title                  = req.Title,
            Description            = $"مهمة من: {senderName}\n{req.Description ?? ""}".Trim(),
            UserPriority           = req.UserPriority ?? 3,
            RequiredCognitiveLoad  = CognitiveLoad.Medium,
            Status                 = Madar.Domain.Enums.TaskStatus.Inbox,
            CreatedAt              = DateTime.UtcNow,
            UpdatedAt              = DateTime.UtcNow,
        };

        _db.SmartTasks.Add(task);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "تم إرسال المهمة بنجاح" });
    }

    /// <summary>تحويل مهمة موجودة لمستخدم آخر</summary>
    [HttpPost("{id:guid}/transfer")]
    public async Task<IActionResult> TransferTask(
        Guid id,
        [FromBody] TransferTaskRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task = await _db.SmartTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);
        if (task is null) return NotFound();

        var targetUser = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.TargetEmail, ct);
        if (targetUser is null)
            return NotFound(new { error = "المستخدم غير موجود" });

        var circleId = await _db.LifeCircles
            .Where(c => c.OwnerId == targetUser.Id && c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);
        if (circleId == Guid.Empty)
            return BadRequest(new { error = "المستخدم ليس لديه دوائر" });

        var senderName = User.FindFirstValue(System.Security.Claims.ClaimTypes.Name) ?? "شخص";

        // أنشئ نسخة في صندوق الوارد للمستلم
        var newTask = new SmartTask
        {
            Id                    = Guid.NewGuid(),
            OwnerId               = targetUser.Id,
            LifeCircleId           = circleId,
            Title                  = task.Title,
            Description            = $"محوّلة من: {senderName}\n{task.Description ?? ""}".Trim(),
            UserPriority           = task.UserPriority,
            RequiredCognitiveLoad  = task.RequiredCognitiveLoad,
            DueDate                = task.DueDate,
            Status                 = Madar.Domain.Enums.TaskStatus.Inbox,
            ContextNote            = task.ContextNote,
            CreatedAt              = DateTime.UtcNow,
            UpdatedAt              = DateTime.UtcNow,
        };
        _db.SmartTasks.Add(newTask);

        // أضف ملاحظة على المهمة الأصلية
        task.ContextNote = (task.ContextNote ?? "") + $"|transferred_to:{targetUser.FullName}";
        task.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = $"تم تحويل المهمة إلى {targetUser.FullName}" });
    }
}

public class TransferTaskRequest { public string TargetEmail { get; set; } = ""; }
public class AcceptRejectRequest { public bool Accept { get; set; } }
public class AssignTaskRequest
{
    public string TargetEmail { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int? UserPriority { get; set; } = 3;
}

public class CreateTaskRequest
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int? UserPriority { get; set; } = 3;
    public CognitiveLoad? CognitiveLoad { get; set; } = Madar.Domain.Enums.CognitiveLoad.Medium;
    public DateTime? DueDate { get; set; }
    public Guid? LifeCircleId { get; set; }
    public Guid? GoalId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public bool? IsRecurring { get; set; } = false;
    public string? RecurrenceRule { get; set; }
    public bool? IsWorkTask { get; set; } = false;
    public bool? IsUrgent { get; set; } = false;
    public string? WaitingFor { get; set; }
    public string? TaskContext { get; set; }
    public string? SuitablePeriod { get; set; }
    // Phase 3 fields
    public decimal? Cost { get; set; }
    public string? CostCurrency { get; set; }
    public Guid? AssignedToId { get; set; }
    public Guid? ProjectId { get; set; }
}

public class UpdateStatusRequest
{
    public Madar.Domain.Enums.TaskStatus Status { get; set; }
}

public class UpdateTaskRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? UserPriority { get; set; }
    public string? TaskContext { get; set; }
    public string? SuitablePeriod { get; set; }
    public Guid? LifeCircleId { get; set; }
    public Guid? GoalId { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? Cost { get; set; }
}
