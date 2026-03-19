using Microsoft.AspNetCore.Identity;
using Madar.Domain.Entities.Core;
using Madar.Domain.Enums;
namespace Madar.Domain.Entities.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = default!;
    public string? AvatarUrl { get; set; }
    public string? TimeZoneId { get; set; }
    public string? Latitude { get; set; }
    public string? Longitude { get; set; }
    public CalculationMethod PrayerCalculationMethod { get; set; } = CalculationMethod.UmmAlQura;
    public EnergyProfile EnergyProfile { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    public string? PreferencesJson { get; set; }
    public ICollection<UserEcosystemMember> EcosystemMemberships { get; set; } = [];
    public ICollection<LifeCircle> OwnedCircles { get; set; } = [];
    public ICollection<SmartTask> Tasks { get; set; } = [];
    public ICollection<UserPermission> Permissions { get; set; } = [];
    public ICollection<DailyEnergyLog> EnergyLogs { get; set; } = [];
    public ICollection<InboxItem> InboxItems { get; set; } = [];
    public ICollection<Contract> Contracts   { get; set; } = [];
}
