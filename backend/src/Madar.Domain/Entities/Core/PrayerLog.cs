using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class PrayerLog
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public DateOnly Date { get; set; }
    /// <summary>Fajr, Dhuhr, Asr, Maghrib, Isha</summary>
    public string Prayer { get; set; } = default!;
    public bool PrayedOnTime { get; set; }
    public bool PrayedInMosque { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}

public class PrayerPenalty
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public DateOnly Date { get; set; }
    public string Prayer { get; set; } = default!;
    /// <summary>not_on_time, not_in_mosque</summary>
    public string Reason { get; set; } = "not_on_time";
    public string PenaltyType { get; set; } = "surah";
    public string? PenaltyDetail { get; set; }
    public bool Fulfilled { get; set; }
    public DateTime? FulfilledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}

public class PrayerSettings
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    /// <summary>JSON: {"Fajr_time":"surah","Fajr_mosque":"rakaat",...}</summary>
    public string PenaltyConfigJson { get; set; } = "{}";
    public bool NotificationsEnabled { get; set; } = true;
    public ApplicationUser Owner { get; set; } = default!;
}
