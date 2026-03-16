using Madar.Domain.Entities.Identity;
using Madar.Domain.Enums;

namespace Madar.Domain.Entities.Core;

public class Contract
{
    public Guid   Id          { get; set; } = Guid.NewGuid();
    public Guid   OwnerId     { get; set; }

    public string  Title       { get; set; } = default!;
    public string  ClientName  { get; set; } = default!;
    public string? Description { get; set; }
    public string? Notes       { get; set; }

    public ContractStatus Status   { get; set; } = ContractStatus.Draft;

    public decimal? Value    { get; set; }
    public string   Currency { get; set; } = "SAR";

    public DateTime? StartDate { get; set; }
    public DateTime? EndDate   { get; set; }

    /// <summary>كم يوماً قبل انتهاء العقد يُرسل تنبيه التجديد</summary>
    public int RenewalReminderDays { get; set; } = 30;

    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // ── Navigation ────────────────────────────────────────────────────────────
    public ApplicationUser Owner { get; set; } = default!;
}
