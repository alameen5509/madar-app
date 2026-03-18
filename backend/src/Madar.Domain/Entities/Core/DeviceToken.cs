using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class DeviceToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = default!;
    public string Platform { get; set; } = "android"; // "android" | "ios"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = default!;
}

public class NotificationPreference
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public bool OverdueTasks { get; set; } = true;
    public bool PrayerReminders { get; set; } = true;
    public bool HabitReminders { get; set; } = true;
    public bool InboxMessages { get; set; } = true;
    public int PrayerReminderMinutesBefore { get; set; } = 15;

    public ApplicationUser User { get; set; } = default!;
}

public class WatchLinkRequest_Entity
{
    public Guid Id { get; set; }
    public string DeviceId { get; set; } = default!;
    public string DeviceName { get; set; } = default!;
    public Guid? UserId { get; set; }
    public string Status { get; set; } = "pending"; // pending, approved, rejected
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMinutes(10);
}
