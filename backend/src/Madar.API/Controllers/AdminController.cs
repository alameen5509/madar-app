using System.Security.Claims;
using Madar.Application.Interfaces;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly MadarDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;

    public AdminController(
        MadarDbContext db,
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService)
    {
        _db = db;
        _userManager = userManager;
        _tokenService = tokenService;
    }

    /// <summary>كل المهام لكل المستخدمين</summary>
    [HttpGet("tasks")]
    public async Task<IActionResult> GetAllTasks(CancellationToken ct)
    {
        var tasks = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .Include(t => t.Owner)
            .Include(t => t.Project)
            .Include(t => t.AssignedTo)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Title, t.Description,
                status = t.Status.ToString(),
                t.UserPriority, t.AiPriorityScore,
                t.DueDate, t.CompletedAt, t.CreatedAt,
                t.Cost, t.CostCurrency,
                owner = new { t.Owner.Id, t.Owner.FullName, t.Owner.Email },
                assignedTo = t.AssignedTo == null ? null : new { t.AssignedTo.Id, t.AssignedTo.FullName },
                project = t.Project == null ? null : new { t.Project.Id, t.Project.Title },
                lifeCircle = t.LifeCircle == null ? null : new { t.LifeCircle.Id, t.LifeCircle.Name },
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }

    /// <summary>تعديل كامل لمهمة (كل الحقول)</summary>
    [HttpPut("tasks/{id:guid}")]
    public async Task<IActionResult> UpdateTask(Guid id, [FromBody] AdminUpdateTaskRequest req, CancellationToken ct)
    {
        var task = await _db.SmartTasks.FindAsync(new object[] { id }, ct);
        if (task is null) return NotFound();

        if (req.Title is not null) task.Title = req.Title;
        if (req.Description is not null) task.Description = req.Description;
        if (req.UserPriority.HasValue) task.UserPriority = req.UserPriority.Value;
        if (req.Status is not null && Enum.TryParse<Madar.Domain.Enums.TaskStatus>(req.Status, out var status))
            task.Status = status;
        if (req.DueDate.HasValue) task.DueDate = req.DueDate.Value;
        if (req.Cost.HasValue) task.Cost = req.Cost.Value;
        if (req.CostCurrency is not null) task.CostCurrency = req.CostCurrency;
        if (req.AssignedToId.HasValue) task.AssignedToId = req.AssignedToId.Value;
        if (req.ProjectId.HasValue) task.ProjectId = req.ProjectId.Value;
        task.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم تحديث المهمة" });
    }

    /// <summary>ملخص ميزانية مشروع</summary>
    [HttpGet("projects/{id:guid}/budget")]
    public async Task<IActionResult> GetProjectBudget(Guid id, CancellationToken ct)
    {
        var project = await _db.Projects
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (project is null) return NotFound();

        var totalCost = project.Tasks.Sum(t => t.Cost ?? 0);
        var remaining = project.Budget - totalCost;

        return Ok(new
        {
            project.Id,
            project.Title,
            project.Budget,
            project.Currency,
            totalCost,
            remaining,
            taskCount = project.Tasks.Count,
            overBudget = remaining < 0,
        });
    }

    /// <summary>استعراض مستخدم — يولّد JWT مؤقت</summary>
    [HttpPost("impersonate/{userId:guid}")]
    public async Task<IActionResult> Impersonate(Guid userId, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var targetUser = await _userManager.FindByIdAsync(userId.ToString());
        if (targetUser is null) return NotFound(new { error = "المستخدم غير موجود" });

        var roles = await _userManager.GetRolesAsync(targetUser);
        var accessToken = _tokenService.GenerateAccessToken(targetUser, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        // Note: In production, add custom claims (impersonator, isImpersonating) to the JWT
        return Ok(new
        {
            accessToken,
            refreshToken,
            accessTokenExpiry = DateTime.UtcNow.AddHours(1),
            impersonatedUser = new { targetUser.Id, targetUser.FullName, targetUser.Email },
        });
    }

    /// <summary>إيقاف الاستعراض — يُعالج في الفرونت بإعادة token الأصلي</summary>
    [HttpPost("stop-impersonation")]
    [AllowAnonymous] // Allow since admin token was stored client-side
    public IActionResult StopImpersonation()
    {
        return Ok(new { message = "تم إيقاف الاستعراض" });
    }
}

public class AdminUpdateTaskRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? UserPriority { get; set; }
    public string? Status { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? Cost { get; set; }
    public string? CostCurrency { get; set; }
    public Guid? AssignedToId { get; set; }
    public Guid? ProjectId { get; set; }
}
