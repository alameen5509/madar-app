using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class Project
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public decimal Budget { get; set; }
    public string Currency { get; set; } = "SAR";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<SmartTask> Tasks { get; set; } = [];
}
