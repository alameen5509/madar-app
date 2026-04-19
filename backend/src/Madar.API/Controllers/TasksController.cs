using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
            .Where(t => t.OwnerId == userId && t.Status != Madar.Domain.Enums.TaskStatus.Cancelled && t.ParentTaskId == null)
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
                parentTaskId     = t.ParentTaskId,
                assignedToId     = t.AssignedToId,
                projectId        = t.ProjectId,
                lifeCircleId     = t.LifeCircleId,
                goalId           = t.GoalId,
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

        // ═══ Build root breadcrumb (goal → dimension → job/role) per task ═══
        var taskIds = tasks.Select(t => t.id).ToList();
        var roots = new Dictionary<Guid, object>();

        if (taskIds.Count > 0)
        {
            // Job side: JobGoalTasks → JobGoals → JobDimensions → Work (JobId = Work.Id)
            var jobRoots = await (
                from jgt in _db.JobGoalTasks
                join jg in _db.JobGoals on jgt.GoalId equals jg.Id
                join jd in _db.JobDimensions on jg.DimensionId equals jd.Id
                join w in _db.Works on jd.JobId equals w.Id
                where taskIds.Contains(jgt.TaskId) && w.OwnerId == userId
                select new
                {
                    taskId = jgt.TaskId,
                    kind = "job",
                    entityId = w.Id,
                    entityName = (w.Name ?? w.Title ?? "عمل") + "",
                    entitySlug = (string?)null,
                    dimensionId = jd.Id,
                    dimensionName = jd.Name,
                    goalId = jg.Id,
                    goalTitle = jg.Title
                }
            ).ToListAsync(ct);
            foreach (var r in jobRoots)
                if (!roots.ContainsKey(r.taskId)) roots[r.taskId] = r;

            // Role side: RoleGoalTasks → RoleGoals → RoleDimensions → UserCircles (raw SQL)
            var roleRows = await (
                from rgt in _db.RoleGoalTasks
                join rg in _db.RoleGoals on rgt.GoalId equals rg.Id
                join rd in _db.RoleDimensions on rg.DimensionId equals rd.Id
                where taskIds.Contains(rgt.TaskId)
                select new
                {
                    taskId = rgt.TaskId,
                    roleId = rd.RoleId,
                    dimensionId = rd.Id,
                    dimensionName = rd.Name,
                    goalId = rg.Id,
                    goalTitle = rg.Title
                }
            ).ToListAsync(ct);

            // Look up role name/slug from the raw UserCircles table
            var roleIds = roleRows.Select(r => r.roleId.ToString()).Distinct().ToList();
            var roleMeta = new Dictionary<string, (string name, string? slug)>();
            if (roleIds.Count > 0)
            {
                var conn = _db.Database.GetDbConnection();
                var wasOpen = conn.State == System.Data.ConnectionState.Open;
                if (!wasOpen) await conn.OpenAsync(ct);
                try
                {
                    using var cmd = conn.CreateCommand();
                    var paramNames = roleIds.Select((_, i) => $"@r{i}").ToList();
                    cmd.CommandText = $"SELECT \"Id\", \"DisplayName\", \"Slug\" FROM \"UserCircles\" WHERE \"UserId\"=@uid AND \"Id\" IN ({string.Join(",", paramNames)})";
                    cmd.Parameters.Add(new NpgsqlParameter("@uid", userId.ToString()));
                    for (int i = 0; i < roleIds.Count; i++)
                        cmd.Parameters.Add(new NpgsqlParameter(paramNames[i], roleIds[i]));
                    using var r = await cmd.ExecuteReaderAsync(ct);
                    while (await r.ReadAsync(ct))
                    {
                        var id = r.GetString(0);
                        var name = r.IsDBNull(1) ? "دور" : r.GetString(1);
                        var slug = r.IsDBNull(2) ? null : r.GetString(2);
                        roleMeta[id] = (name, slug);
                    }
                }
                finally { if (!wasOpen) await conn.CloseAsync(); }
            }

            foreach (var r in roleRows)
            {
                if (roots.ContainsKey(r.taskId)) continue; // job root takes precedence
                var key = r.roleId.ToString();
                if (!roleMeta.TryGetValue(key, out var meta)) continue;
                roots[r.taskId] = new
                {
                    taskId = r.taskId,
                    kind = "role",
                    entityId = r.roleId,
                    entityName = meta.name,
                    entitySlug = meta.slug,
                    dimensionId = r.dimensionId,
                    dimensionName = r.dimensionName,
                    goalId = r.goalId,
                    goalTitle = r.goalTitle
                };
            }
        }

        // Fallback: for ALL tasks without root, look up circle name from
        // BOTH LifeCircles (old) and UserCircles (new) tables using raw lifeCircleId
        var unlinkedCircleIds = new HashSet<string>();
        foreach (var t in tasks)
        {
            if (roots.ContainsKey(t.id)) continue;
            if (t.lifeCircleId.HasValue && t.lifeCircleId.Value != Guid.Empty)
                unlinkedCircleIds.Add(t.lifeCircleId.Value.ToString());
        }

        var allCircleNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (unlinkedCircleIds.Count > 0)
        {
            try
            {
                var conn2 = _db.Database.GetDbConnection();
                var wasOpen2 = conn2.State == System.Data.ConnectionState.Open;
                if (!wasOpen2) await conn2.OpenAsync(ct);
                try
                {
                    // Search LifeCircles
                    using (var cmd2 = conn2.CreateCommand())
                    {
                        var pNames = unlinkedCircleIds.Select((_, i) => $"@lc{i}").ToList();
                        cmd2.CommandText = $"SELECT \"Id\", \"Name\" FROM \"LifeCircles\" WHERE \"Id\" IN ({string.Join(",", pNames)})";
                        int ci = 0;
                        foreach (var cid in unlinkedCircleIds) cmd2.Parameters.Add(new NpgsqlParameter(pNames[ci++], cid));
                        using var rr = await cmd2.ExecuteReaderAsync(ct);
                        while (await rr.ReadAsync(ct)) allCircleNames[rr.GetString(0)] = rr.IsDBNull(1) ? "" : rr.GetString(1);
                    }
                    // Search UserCircles
                    using (var cmd3 = conn2.CreateCommand())
                    {
                        var pNames2 = unlinkedCircleIds.Select((_, i) => $"@uc{i}").ToList();
                        cmd3.CommandText = $"SELECT \"Id\", \"DisplayName\" FROM \"UserCircles\" WHERE \"Id\" IN ({string.Join(",", pNames2)})";
                        int ci2 = 0;
                        foreach (var cid in unlinkedCircleIds) cmd3.Parameters.Add(new NpgsqlParameter(pNames2[ci2++], cid));
                        using var rr2 = await cmd3.ExecuteReaderAsync(ct);
                        while (await rr2.ReadAsync(ct))
                            if (!allCircleNames.ContainsKey(rr2.GetString(0)))
                                allCircleNames[rr2.GetString(0)] = rr2.IsDBNull(1) ? "" : rr2.GetString(1);
                    }
                    // Search Works (some tasks link to Work.Id via LifeCircleId)
                    using (var cmd4 = conn2.CreateCommand())
                    {
                        var pNames3 = unlinkedCircleIds.Select((_, i) => $"@wk{i}").ToList();
                        cmd4.CommandText = $"SELECT \"Id\", \"Name\" FROM \"Works\" WHERE \"Id\" IN ({string.Join(",", pNames3)})";
                        int ci3 = 0;
                        foreach (var cid in unlinkedCircleIds) cmd4.Parameters.Add(new NpgsqlParameter(pNames3[ci3++], cid));
                        using var rr3 = await cmd4.ExecuteReaderAsync(ct);
                        while (await rr3.ReadAsync(ct))
                            if (!allCircleNames.ContainsKey(rr3.GetString(0)))
                                allCircleNames[rr3.GetString(0)] = rr3.IsDBNull(1) ? "" : rr3.GetString(1);
                    }
                }
                finally { if (!wasOpen2) await conn2.CloseAsync(); }
            } catch {}
        }

        foreach (var t in tasks)
        {
            if (roots.ContainsKey(t.id)) continue;
            var circleName = t.lifeCircle?.name ?? "";
            if (string.IsNullOrEmpty(circleName) && t.lifeCircleId.HasValue)
                allCircleNames.TryGetValue(t.lifeCircleId.Value.ToString(), out circleName);
            var goalTitle = t.goal?.Title ?? "";

            if (!string.IsNullOrEmpty(circleName) || !string.IsNullOrEmpty(goalTitle))
            {
                var entityId = t.lifeCircleId ?? (t.goal != null ? t.goal.Id : Guid.Empty);
                roots[t.id] = new
                {
                    taskId = t.id,
                    kind = "legacy",
                    entityId,
                    entityName = circleName ?? "",
                    entitySlug = (string?)null,
                    dimensionId = Guid.Empty,
                    dimensionName = "",
                    goalId = t.goal != null ? (object)t.goal.Id : Guid.Empty,
                    goalTitle
                };
            }
        }

        // Merge root into each task response
        var withRoots = tasks.Select(t => new
        {
            t.id, t.title, t.description, t.status, t.userPriority, t.aiPriorityScore,
            t.cognitiveLoad, t.dueDate, t.isRecurring, t.recurrenceRule, t.contextNote,
            t.estimatedDurationMinutes, t.actualDurationMinutes, t.completedAt, t.createdAt,
            t.wasCompletedOnTime, t.cost, t.costCurrency, t.parentTaskId, t.assignedToId,
            t.projectId, t.goal, t.assignedTo, t.lifeCircle,
            root = roots.TryGetValue(t.id, out var r) ? r : null
        });

        return Ok(withRoots);
    }

    /// <summary>Debug: show unlinked tasks with their raw IDs</summary>
    [HttpGet("debug-unlinked")]
    public async Task<IActionResult> DebugUnlinked(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var tasks = await _db.SmartTasks
            .Where(t => t.OwnerId == userId && t.Status != Madar.Domain.Enums.TaskStatus.Cancelled && t.ParentTaskId == null)
            .Select(t => new { t.Id, t.Title, t.LifeCircleId, t.GoalId, hasCircle = t.LifeCircle != null, circleName = t.LifeCircle != null ? t.LifeCircle.Name : null })
            .ToListAsync(ct);

        // Check which have JobGoalTasks or RoleGoalTasks
        var allIds = tasks.Select(t => t.Id).ToList();
        var jobLinked = new HashSet<Guid>(await _db.JobGoalTasks.Where(j => allIds.Contains(j.TaskId)).Select(j => j.TaskId).ToListAsync(ct));
        var roleLinked = new HashSet<Guid>(await _db.RoleGoalTasks.Where(r => allIds.Contains(r.TaskId)).Select(r => r.TaskId).ToListAsync(ct));

        var unlinked = tasks.Where(t => !jobLinked.Contains(t.Id) && !roleLinked.Contains(t.Id) && !t.hasCircle && t.GoalId == null && t.LifeCircleId == null).ToList();
        var hasCircleIdOnly = tasks.Where(t => !jobLinked.Contains(t.Id) && !roleLinked.Contains(t.Id) && t.LifeCircleId != null && !t.hasCircle).ToList();

        return Ok(new
        {
            total = tasks.Count,
            withJobGoal = jobLinked.Count,
            withRoleGoal = roleLinked.Count,
            withCircleNav = tasks.Count(t => t.hasCircle),
            withCircleIdOnly = hasCircleIdOnly.Count,
            trulyUnlinked = unlinked.Count,
            sampleUnlinked = unlinked.Take(5).Select(t => new { t.Id, t.Title, t.LifeCircleId, t.GoalId }),
            sampleCircleIdOnly = hasCircleIdOnly.Take(5).Select(t => new { t.Id, t.Title, t.LifeCircleId, t.GoalId }),
        });
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
                req.Session != null ? $"session:{req.Session}" : null,
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
        if (req.Session is not null)
        {
            var parts = (task.ContextNote ?? "").Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => !p.StartsWith("session:")).ToList();
            if (!string.IsNullOrEmpty(req.Session))
                parts.Add($"session:{req.Session}");
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
    public string? Session { get; set; }
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
    public string? Session { get; set; }
    public Guid? LifeCircleId { get; set; }
    public Guid? GoalId { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? Cost { get; set; }
}
