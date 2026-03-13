using Madar.Domain.Enums;
using Madar.Domain.Entities.Identity;
namespace Madar.Domain.Entities.Core;

public class EnergyProfile
{
    public Guid Id { get; set; }
    public SalahBlock PeakEnergyBlock { get; set; } = SalahBlock.PostFajr;
    public SalahBlock SecondaryEnergyBlock { get; set; } = SalahBlock.PostAsr;
    public SalahBlock LowEnergyBlock { get; set; } = SalahBlock.PostDhuhr;
    public Chronotype Chronotype { get; set; } = Chronotype.EarlyBird;
    public double AverageSleepHours { get; set; } = 7.0;
    public bool IsFastingUser { get; set; }
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DailyEnergyLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateOnly LogDate { get; set; }
    public SalahBlock Block { get; set; }
    public int EnergyLevel { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser User { get; set; } = default!;
}

public class InboxItem
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Content { get; set; } = default!;
    public bool IsProcessed { get; set; }
    public Guid? ConvertedToTaskId { get; set; }
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public SmartTask? ConvertedTask { get; set; }
}
