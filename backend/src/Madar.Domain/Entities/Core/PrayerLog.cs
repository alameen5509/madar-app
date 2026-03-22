using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class PrayerLog
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public DateOnly Date { get; set; }
    /// <summary>Fajr, Duha, Dhuhr, Asr, Maghrib, Isha</summary>
    public string Prayer { get; set; } = default!;
    /// <summary>OnTime, InMosque, Missed, None</summary>
    public string Status { get; set; } = "None";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}

public class PrayerPenalty
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public DateOnly Date { get; set; }
    public string Prayer { get; set; } = default!;
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
    /// <summary>JSON: {"Fajr":"surah","Dhuhr":"rakaat",...}</summary>
    public string PenaltyConfigJson { get; set; } = "{}";
    public bool NotificationsEnabled { get; set; } = true;
    public ApplicationUser Owner { get; set; } = default!;
}
