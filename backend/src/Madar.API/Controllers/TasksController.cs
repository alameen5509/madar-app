using System.Security.Claims;
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
            .Where(t => t.OwnerId == userId)
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

    /// <summary>تغيير حالة مهمة (مثلاً إكمالها)</summary>
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

        task.Status    = req.Status;
        task.UpdatedAt = DateTime.UtcNow;

        if (req.Status == Madar.Domain.Enums.TaskStatus.Completed)
            task.CompletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record UpdateStatusRequest(Madar.Domain.Enums.TaskStatus Status);
