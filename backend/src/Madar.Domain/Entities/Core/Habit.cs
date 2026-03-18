using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

public class Habit
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public string Icon { get; set; } = "⭐";
    public string Category { get; set; } = "worship";
    public bool IsIdea { get; set; }
    public int Streak { get; set; }
    public DateTime? LastCompletedDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}
