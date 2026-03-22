using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

/// <summary>Job dimension (aspect) — supports hierarchy via ParentDimensionId</summary>
public class JobDimension
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
    public Guid? ParentDimensionId { get; set; }
    public string Name { get; set; } = default!;
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int Priority { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LifeCircle Job { get; set; } = default!;
    public JobDimension? ParentDimension { get; set; }
    public ICollection<JobDimension> SubDimensions { get; set; } = [];
    public ICollection<JobGoal> Goals { get; set; } = [];
}

/// <summary>Job goal — supports hierarchy via ParentGoalId</summary>
public class JobGoal
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
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

    public LifeCircle Job { get; set; } = default!;
    public JobDimension Dimension { get; set; } = default!;
    public JobGoal? ParentGoal { get; set; }
    public ICollection<JobGoal> SubGoals { get; set; } = [];
    public ICollection<JobGoalProject> Projects { get; set; } = [];
    public ICollection<JobGoalTask> Tasks { get; set; } = [];
}

/// <summary>Link between goal and project</summary>
public class JobGoalProject
{
    public Guid Id { get; set; }
    public Guid GoalId { get; set; }
    public Guid ProjectId { get; set; }

    public JobGoal Goal { get; set; } = default!;
    public Project Project { get; set; } = default!;
}

/// <summary>Link between goal and task</summary>
public class JobGoalTask
{
    public Guid Id { get; set; }
    public Guid GoalId { get; set; }
    public Guid TaskId { get; set; }

    public JobGoal Goal { get; set; } = default!;
    public SmartTask Task { get; set; } = default!;
}
