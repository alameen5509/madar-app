using Madar.Domain.Enums;
using Madar.Domain.Entities.Identity;
namespace Madar.Domain.Entities.Core;

public class LifeCircle
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid EcosystemId { get; set; }
    public Guid? ParentCircleId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? IconKey { get; set; }
    public string? ColorHex { get; set; }
    public CircleTier Tier { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsShariaPriority { get; set; }
    public bool IsActive { get; set; } = true;
    public ApplicationUser Owner { get; set; } = default!;
    public Ecosystem Ecosystem { get; set; } = default!;
    public LifeCircle? ParentCircle { get; set; }
    public ICollection<LifeCircle> SubCircles { get; set; } = [];
    public ICollection<SmartTask> Tasks { get; set; } = [];
    public ICollection<Goal> Goals { get; set; } = [];
}

public class Goal
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid LifeCircleId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public DateTime? TargetDate { get; set; }
    public int PriorityWeight { get; set; } = 5;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public LifeCircle LifeCircle { get; set; } = default!;
    public ICollection<SmartTask> LinkedTasks { get; set; } = [];
}
