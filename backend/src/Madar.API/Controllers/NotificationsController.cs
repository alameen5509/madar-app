using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public NotificationsController(MadarDbContext db) => _db = db;

    /// <summary>تسجيل جهاز لاستقبال الإشعارات</summary>
    [HttpPost("register-device")]
    public async Task<IActionResult> RegisterDevice([FromBody] RegisterDeviceRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Check if token already exists
        var existing = await _db.DeviceTokens
            .FirstOrDefaultAsync(d => d.UserId == userId && d.Token == req.Token, ct);

        if (existing is not null)
        {
            existing.LastUsedAt = DateTime.UtcNow;
            existing.Platform = req.Platform ?? "android";
        }
        else
        {
            _db.DeviceTokens.Add(new DeviceToken
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Token = req.Token,
                Platform = req.Platform ?? "android",
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم تسجيل الجهاز" });
    }

    /// <summary>إلغاء تسجيل جهاز</summary>
    [HttpDelete("unregister-device")]
    public async Task<IActionResult> UnregisterDevice([FromBody] UnregisterDeviceRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var device = await _db.DeviceTokens
            .FirstOrDefaultAsync(d => d.UserId == userId && d.Token == req.Token, ct);

        if (device is not null)
        {
            _db.DeviceTokens.Remove(device);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { message = "تم إلغاء تسجيل الجهاز" });
    }

    /// <summary>تفضيلات الإشعارات</summary>
    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var prefs = await _db.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (prefs is null)
        {
            prefs = new NotificationPreference { Id = Guid.NewGuid(), UserId = userId };
            _db.NotificationPreferences.Add(prefs);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new
        {
            prefs.OverdueTasks,
            prefs.PrayerReminders,
            prefs.HabitReminders,
            prefs.InboxMessages,
            prefs.PrayerReminderMinutesBefore,
        });
    }

    /// <summary>تحديث تفضيلات الإشعارات</summary>
    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdatePreferencesRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var prefs = await _db.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (prefs is null)
        {
            prefs = new NotificationPreference { Id = Guid.NewGuid(), UserId = userId };
            _db.NotificationPreferences.Add(prefs);
        }

        if (req.OverdueTasks.HasValue) prefs.OverdueTasks = req.OverdueTasks.Value;
        if (req.PrayerReminders.HasValue) prefs.PrayerReminders = req.PrayerReminders.Value;
        if (req.HabitReminders.HasValue) prefs.HabitReminders = req.HabitReminders.Value;
        if (req.InboxMessages.HasValue) prefs.InboxMessages = req.InboxMessages.Value;
        if (req.PrayerReminderMinutesBefore.HasValue)
            prefs.PrayerReminderMinutesBefore = req.PrayerReminderMinutesBefore.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم تحديث التفضيلات" });
    }
}

public class RegisterDeviceRequest
{
    public string Token { get; set; } = "";
    public string? Platform { get; set; }
}

public class UnregisterDeviceRequest
{
    public string Token { get; set; } = "";
}

public class UpdatePreferencesRequest
{
    public bool? OverdueTasks { get; set; }
    public bool? PrayerReminders { get; set; }
    public bool? HabitReminders { get; set; }
    public bool? InboxMessages { get; set; }
    public int? PrayerReminderMinutesBefore { get; set; }
}
