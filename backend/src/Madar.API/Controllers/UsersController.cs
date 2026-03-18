using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class UsersController : BaseController
{
    private readonly MadarDbContext _db;
    public UsersController(MadarDbContext db) => _db = db;

    /// <summary>قائمة كل المستخدمين المسجلين (للمشرف)</summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var users = await _db.Users
            .OrderByDescending(u => u.LastLoginAt)
            .Select(u => new
            {
                id          = u.Id,
                fullName    = u.FullName,
                email       = u.Email,
                avatarUrl   = u.AvatarUrl,
                isActive    = u.IsActive,
                lastLoginAt = u.LastLoginAt,
                createdAt   = u.CreatedAt,
            })
            .ToListAsync(ct);

        return Ok(users);
    }

    /// <summary>مهام مستخدم محدد (للمتابعة)</summary>
    [HttpGet("{userId:guid}/tasks")]
    public async Task<IActionResult> GetUserTasks(Guid userId, CancellationToken ct)
    {
        var tasks = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .Where(t => t.OwnerId == userId)
            .OrderByDescending(t => t.UserPriority)
            .ThenBy(t => t.CreatedAt)
            .Select(t => new
            {
                id              = t.Id,
                title           = t.Title,
                status          = t.Status.ToString(),
                userPriority    = t.UserPriority,
                dueDate         = t.DueDate,
                completedAt     = t.CompletedAt,
                actualDuration  = t.ActualDurationMinutes,
                wasOnTime       = t.WasCompletedOnTime,
                contextNote     = t.ContextNote,
                lifeCircle      = t.LifeCircle == null ? null : new
                {
                    id   = t.LifeCircle.Id,
                    name = t.LifeCircle.Name,
                }
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }

    /// <summary>أهداف مستخدم محدد</summary>
    [HttpGet("{userId:guid}/goals")]
    public async Task<IActionResult> GetUserGoals(Guid userId, CancellationToken ct)
    {
        var goals = await _db.Goals
            .Include(g => g.LinkedTasks)
            .Where(g => g.OwnerId == userId)
            .OrderByDescending(g => g.TargetDate)
            .Select(g => new
            {
                id              = g.Id,
                title           = g.Title,
                status          = g.Status.ToString(),
                progressPercent = g.LinkedTasks.Count == 0 ? 0
                    : (int)Math.Round(100.0 * g.LinkedTasks.Count(t => t.Status == Domain.Enums.TaskStatus.Completed) / g.LinkedTasks.Count),
            })
            .ToListAsync(ct);

        return Ok(goals);
    }

    /// <summary>تعديل بيانات مستخدم</summary>
    [HttpPatch("{userId:guid}")]
    public async Task<IActionResult> UpdateUser(
        Guid userId,
        [FromBody] UpdateUserRequest req,
        CancellationToken ct)
    {
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null) return NotFound();

        if (req.FullName is not null) user.FullName = req.FullName;
        if (req.IsActive is not null) user.IsActive = req.IsActive.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(new { user.Id, user.FullName, user.Email, user.IsActive });
    }
}

public record UpdateUserRequest(
    string? FullName = null,
    bool? IsActive = null
);
