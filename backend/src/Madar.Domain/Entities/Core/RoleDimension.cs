namespace Madar.Domain.Entities.Core;

/// <summary>Life-role dimension (aspect) — supports hierarchy via ParentDimensionId.
/// RoleId references a UserCircles row (raw SQL table — no EF navigation).</summary>
public class RoleDimension
{
    public Guid Id { get; set; }
    public Guid RoleId { get; set; }
    public Guid? ParentDimensionId { get; set; }
    public string Name { get; set; } = default!;
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int Priority { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RoleDimension? ParentDimension { get; set; }
    public ICollection<RoleDimension> SubDimensions { get; set; } = [];
    public ICollection<RoleGoal> Goals { get; set; } = [];
}

/// <summary>Life-role goal — supports hierarchy via ParentGoalId</summary>
public class RoleGoal
{
    public Guid Id { get; set; }
    public Guid RoleId { get; set; }
    public Guid DimensionId { get; set; }
    public Guid? ParentGoalId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public DateTime? DueDate { get; set; }
    public int Progress { get; set; }
    public string Status { get; set; } = "Active";
    public int Priority { get; set; }
    public string? Timeframe { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RoleDimension Dimension { get; set; } = default!;
    public RoleGoal? ParentGoal { get; set; }
    public ICollection<RoleGoal> SubGoals { get; set; } = [];
    public ICollection<RoleGoalProject> Projects { get; set; } = [];
    public ICollection<RoleGoalTask> Tasks { get; set; } = [];
}

/// <summary>Link between role-goal and project</summary>
public class RoleGoalProject
{
    public Guid Id { get; set; }
    public Guid GoalId { get; set; }
    public Guid ProjectId { get; set; }

    public RoleGoal Goal { get; set; } = default!;
    public Project Project { get; set; } = default!;
}

/// <summary>Link between role-goal and task</summary>
public class RoleGoalTask
{
    public Guid Id { get; set; }
    public Guid GoalId { get; set; }
    public Guid TaskId { get; set; }

    public RoleGoal Goal { get; set; } = default!;
    public SmartTask Task { get; set; } = default!;
}
