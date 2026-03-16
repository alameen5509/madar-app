using System.Security.Claims;
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
}
