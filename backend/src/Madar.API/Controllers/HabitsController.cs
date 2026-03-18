using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class HabitsController : BaseController
{
    private readonly MadarDbContext _db;
    public HabitsController(MadarDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetHabits(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var habits = await _db.Habits
            .Where(h => h.OwnerId == userId)
            .OrderBy(h => h.CreatedAt)
            .Select(h => new
            {
                h.Id, h.Title, h.Icon, h.Category, h.IsIdea, h.Streak,
                h.LastCompletedDate,
                todayDone = h.LastCompletedDate != null &&
                    h.LastCompletedDate.Value.Date == DateTime.UtcNow.Date,
            })
            .ToListAsync(ct);

        return Ok(habits);
    }

    [HttpPost]
    public async Task<IActionResult> CreateHabit([FromBody] CreateHabitRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var habit = new Habit
        {
            Id = Guid.NewGuid(), OwnerId = userId,
            Title = req.Title, Icon = req.Icon ?? "⭐",
            Category = req.Category ?? "worship", IsIdea = req.IsIdea ?? false,
        };
        _db.Habits.Add(habit);
        await _db.SaveChangesAsync(ct);
        return Ok(new { habit.Id, habit.Title, habit.Icon, habit.Category, habit.IsIdea, habit.Streak, todayDone = false });
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var habit = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id && h.OwnerId == userId, ct);
        if (habit is null) return NotFound();

        var today = DateTime.UtcNow.Date;
        if (habit.LastCompletedDate?.Date == today)
        {
            habit.Streak = Math.Max(0, habit.Streak - 1);
            habit.LastCompletedDate = null;
        }
        else
        {
            habit.Streak++;
            habit.LastCompletedDate = today;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { habit.Streak, todayDone = habit.LastCompletedDate?.Date == today });
    }

    [HttpPatch("{id:guid}/idea")]
    public async Task<IActionResult> ToggleIdea(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var habit = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id && h.OwnerId == userId, ct);
        if (habit is null) return NotFound();
        habit.IsIdea = !habit.IsIdea;
        await _db.SaveChangesAsync(ct);
        return Ok(new { habit.IsIdea });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var habit = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id && h.OwnerId == userId, ct);
        if (habit is null) return NotFound();
        _db.Habits.Remove(habit);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record CreateHabitRequest(string Title, string? Icon = "⭐", string? Category = "worship", bool? IsIdea = false);
