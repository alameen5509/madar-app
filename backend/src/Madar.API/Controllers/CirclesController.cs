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
public class CirclesController : BaseController
{
    private readonly MadarDbContext _db;
    public CirclesController(MadarDbContext db) => _db = db;

    /// <summary>قائمة دوائر الحياة للمستخدم مع إحصائيات الأهداف والإنجاز</summary>
    [HttpGet]
    public async Task<IActionResult> GetCircles(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Seed default circles on first use if user has none
        var hasCircles = await _db.LifeCircles.AnyAsync(lc => lc.OwnerId == userId, ct);
        if (!hasCircles)
            await SeedDefaultCirclesAsync(userId, ct);

        // Load everything in one query then project in-memory to avoid EF translation issues
        var circles = await _db.LifeCircles
            .Include(lc => lc.Goals)
                .ThenInclude(g => g.LinkedTasks)
            .Where(lc => lc.OwnerId == userId && lc.IsActive)
            .OrderBy(lc => lc.DisplayOrder)
            .ThenBy(lc => lc.Name)
            .ToListAsync(ct);

        var result = circles.Select(lc =>
        {
            var allTasks       = lc.Goals.SelectMany(g => g.LinkedTasks).ToList();
            var completedTasks = allTasks.Count(t => t.Status == Madar.Domain.Enums.TaskStatus.Completed);

            return new
            {
                id               = lc.Id,
                name             = lc.Name,
                description      = lc.Description,
                iconKey          = lc.IconKey,
                colorHex         = lc.ColorHex ?? "#5E5495",
                tier             = lc.Tier.ToString(),
                displayOrder     = lc.DisplayOrder,
                isShariaPriority = lc.IsShariaPriority,
                isActive         = lc.IsActive,
                parentCircleId   = lc.ParentCircleId,
                goalCount         = lc.Goals.Count(g => g.Status == GoalStatus.Active),
                taskCount         = allTasks.Count,
                completedTaskCount = completedTasks,
                progressPercent  = allTasks.Count == 0
                    ? 0
                    : (int)Math.Round((double)completedTasks / allTasks.Count * 100),
                goals = lc.Goals
                    .OrderBy(g => g.TargetDate)
                    .Select(g =>
                    {
                        var gCompleted = g.LinkedTasks.Count(t => t.Status == Madar.Domain.Enums.TaskStatus.Completed);
                        return new
                        {
                            id              = g.Id,
                            title           = g.Title,
                            description     = g.Description,
                            status          = g.Status.ToString(),
                            targetDate      = g.TargetDate,
                            progressPercent = g.LinkedTasks.Count == 0
                                ? 0
                                : (int)Math.Round((double)gCompleted / g.LinkedTasks.Count * 100)
                        };
                    })
                    .ToList()
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>تهيئة دوائر الحياة الافتراضية عند أول استخدام</summary>
    private async Task SeedDefaultCirclesAsync(Guid userId, CancellationToken ct)
    {
        var ecosystem = await _db.Ecosystems.FirstOrDefaultAsync(e => e.OwnerId == userId, ct);
        if (ecosystem is null)
        {
            ecosystem = new Ecosystem { Id = Guid.NewGuid(), Name = "شخصي", OwnerId = userId };
            _db.Ecosystems.Add(ecosystem);
            await _db.SaveChangesAsync(ct);
        }

        var seeds = new LifeCircle[]
        {
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "دائرة الأساس", Description = "البوصلة والوقود — الأدوار: عبد الله، نفسي",
                IconKey = "🌙", ColorHex = "#C0392B", Tier = CircleTier.Base,
                DisplayOrder = 0, IsShariaPriority = true, IsActive = true },
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "الدائرة الأولى", Description = "الأسرة المباشرة — الأدوار: ابن، أب، زوج",
                IconKey = "🏡", ColorHex = "#E8631A", Tier = CircleTier.First,
                DisplayOrder = 1, IsShariaPriority = true, IsActive = true },
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "الدائرة الثانية", Description = "صلة الأرحام — الأدوار: أخ، خال، أهل",
                IconKey = "🤝", ColorHex = "#C9A84C", Tier = CircleTier.Second,
                DisplayOrder = 2, IsShariaPriority = false, IsActive = true },
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "الدائرة الثالثة", Description = "المصاهرة — الأدوار: صهر، نسيب، عديل",
                IconKey = "🌿", ColorHex = "#4A8C3D", Tier = CircleTier.Third,
                DisplayOrder = 3, IsShariaPriority = false, IsActive = true },
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "الدائرة الرابعة", Description = "أهل الفضل ورعاية — الأدوار: معلم، طالب",
                IconKey = "📚", ColorHex = "#2D6B9E", Tier = CircleTier.Fourth,
                DisplayOrder = 4, IsShariaPriority = false, IsActive = true },
            new() { Id = Guid.NewGuid(), OwnerId = userId, EcosystemId = ecosystem.Id,
                Name = "الدائرة الخامسة", Description = "المجتمع والنمو",
                IconKey = "🌍", ColorHex = "#5E5495", Tier = CircleTier.Fifth,
                DisplayOrder = 5, IsShariaPriority = false, IsActive = true },
        };

        _db.LifeCircles.AddRange(seeds);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>إنشاء دائرة حياة جديدة — يُنشئ نظام بيئي شخصي إن لم يكن موجوداً</summary>
    [HttpPost]
    public async Task<IActionResult> CreateCircle(
        [FromBody] CreateCircleRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "اسم الدائرة مطلوب" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Find or auto-create a personal ecosystem for the user
        var ecosystem = await _db.Ecosystems
            .FirstOrDefaultAsync(e => e.OwnerId == userId, ct);

        if (ecosystem is null)
        {
            ecosystem = new Ecosystem
            {
                Id      = Guid.NewGuid(),
                Name    = "شخصي",
                OwnerId = userId,
            };
            _db.Ecosystems.Add(ecosystem);
            await _db.SaveChangesAsync(ct);
        }

        var circle = new LifeCircle
        {
            Id               = Guid.NewGuid(),
            OwnerId          = userId,
            EcosystemId      = ecosystem.Id,
            Name             = req.Name.Trim(),
            Description      = req.Description?.Trim(),
            IconKey          = req.IconKey,
            ColorHex         = req.ColorHex,
            Tier             = Enum.TryParse<CircleTier>(req.Tier, out var tier) ? tier : CircleTier.First,
            DisplayOrder     = req.DisplayOrder ?? 0,
            IsShariaPriority = req.IsShariaPriority ?? false,
            ParentCircleId   = req.ParentCircleId,
            IsActive         = true,
        };

        _db.LifeCircles.Add(circle);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetCircles), new { id = circle.Id }, new
        {
            circle.Id,
            circle.Name,
            circle.Description,
            circle.IconKey,
            colorHex         = circle.ColorHex ?? "#5E5495",
            tier             = circle.Tier.ToString(),
            circle.DisplayOrder,
            circle.IsShariaPriority,
            goalCount         = 0,
            taskCount         = 0,
            completedTaskCount = 0,
            progressPercent  = 0,
            goals            = Array.Empty<object>()
        });
    }
    /// <summary>تعديل اسم أو وصف دائرة حياة</summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateCircle(
        Guid id,
        [FromBody] UpdateCircleRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var circle = await _db.LifeCircles
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (circle is null) return NotFound();

        if (req.Name is not null)        circle.Name             = req.Name.Trim();
        if (req.Description is not null) circle.Description      = req.Description.Trim();
        if (req.IconKey is not null)      circle.IconKey          = req.IconKey;
        if (req.ColorHex is not null)     circle.ColorHex         = req.ColorHex;

        await _db.SaveChangesAsync(ct);
        return Ok(new { circle.Id, circle.Name, circle.Description, circle.IconKey, colorHex = circle.ColorHex ?? "#5E5495" });
    }

    /// <summary>حذف دائرة حياة (مع نقل المهام للدائرة الأولى)</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCircle(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var circle = await _db.LifeCircles
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (circle is null) return NotFound();

        // Find fallback circle
        var fallback = await _db.LifeCircles
            .Where(c => c.OwnerId == userId && c.IsActive && c.Id != id)
            .OrderBy(c => c.DisplayOrder)
            .FirstOrDefaultAsync(ct);

        if (fallback is not null)
        {
            // Move tasks to fallback
            var tasks = await _db.SmartTasks.Where(t => t.LifeCircleId == id).ToListAsync(ct);
            foreach (var t in tasks) t.LifeCircleId = fallback.Id;

            // Move sub-circles
            var subs = await _db.LifeCircles.Where(c => c.ParentCircleId == id).ToListAsync(ct);
            foreach (var s in subs) s.ParentCircleId = null;

            // Move goals
            var goals = await _db.Goals.Where(g => g.LifeCircleId == id).ToListAsync(ct);
            foreach (var g in goals) g.LifeCircleId = fallback.Id;
        }

        _db.LifeCircles.Remove(circle);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>مهام دائرة معيّنة (مباشرة، بدون هدف)</summary>
    [HttpGet("{id:guid}/tasks")]
    public async Task<IActionResult> GetCircleTasks(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var tasks = await _db.SmartTasks
            .Where(t => t.OwnerId == userId && t.LifeCircleId == id)
            .OrderByDescending(t => t.UserPriority)
            .ThenBy(t => t.CreatedAt)
            .Select(t => new
            {
                id           = t.Id,
                title        = t.Title,
                status       = t.Status.ToString(),
                userPriority = t.UserPriority,
                dueDate      = t.DueDate,
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }
}

public record UpdateCircleRequest(
    string? Name        = null,
    string? Description = null,
    string? IconKey     = null,
    string? ColorHex    = null
);

public record CreateCircleRequest(
    string  Name,
    string? Description,
    string? IconKey,
    string? ColorHex,
    string? Tier,
    int?    DisplayOrder,
    bool?   IsShariaPriority,
    Guid?   ParentCircleId
);
