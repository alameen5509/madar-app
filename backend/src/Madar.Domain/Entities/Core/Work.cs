using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class Work
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Type { get; set; } = "job"; // job | entrepreneur
    public string Name { get; set; } = default!;

    // وظيفة مباشرة
    public string? Title { get; set; }
    public string? Employer { get; set; }
    public decimal Salary { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string Status { get; set; } = "active"; // active | ended

    // رجل أعمال
    public string? Sector { get; set; }
    public string? Role { get; set; }
    public decimal OwnershipPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<WorkJob> Jobs { get; set; } = [];
}

public class WorkJob
{
    public Guid Id { get; set; }
    public Guid WorkId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public decimal Salary { get; set; }
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Work Work { get; set; } = default!;
}
