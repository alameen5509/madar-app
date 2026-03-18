using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class TaskEditController : BaseController
{
    private readonly MadarDbContext _db;
    public TaskEditController(MadarDbContext db) => _db = db;

    [HttpPost("{id:guid}")]
    public async Task<IActionResult> EditTask(
        Guid id,
        [FromBody] EditTaskBody req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var task = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);
        if (task is null) return NotFound();

        if (!string.IsNullOrEmpty(req.Title)) task.Title = req.Title;
        if (req.Description is not null) task.Description = req.Description;
        if (req.UserPriority.HasValue) task.UserPriority = req.UserPriority.Value;
        if (!string.IsNullOrEmpty(req.TaskContext))
        {
            var note = task.ContextNote ?? "";
            var ctxMatch = System.Text.RegularExpressions.Regex.Match(note, @"ctx:\w+");
            task.ContextNote = ctxMatch.Success
                ? System.Text.RegularExpressions.Regex.Replace(note, @"ctx:\w+", $"ctx:{req.TaskContext}")
                : (string.IsNullOrEmpty(note) ? $"ctx:{req.TaskContext}" : $"{note}|ctx:{req.TaskContext}");
        }
        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = task.Id, title = task.Title, status = task.Status.ToString() });
    }
}

public class EditTaskBody
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? UserPriority { get; set; }
    public string? TaskContext { get; set; }
}
