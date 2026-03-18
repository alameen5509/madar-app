using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class Contact
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<SmartTask> LinkedTasks { get; set; } = [];
}
