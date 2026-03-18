using Madar.Domain.Enums;
using Madar.Domain.Entities.Identity;
namespace Madar.Domain.Entities.Core;

public class SmartTask
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid LifeCircleId { get; set; }
    public Guid? GoalId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? ContextNote { get; set; }
    public Madar.Domain.Enums.TaskStatus Status { get; set; } = Madar.Domain.Enums.TaskStatus.Inbox;
    public TaskType Type { get; set; } = TaskType.Action;
    public bool IsFromInbox { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? ScheduledStartAt { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public int? ActualDurationMinutes { get; set; }
    public bool IsRecurring { get; set; }
    public string? RecurrenceRule { get; set; }
    public SalahBlock? PreferredSalahBlock { get; set; }
    public bool IsSalahBlockUserOverridden { get; set; }
    public CognitiveLoad RequiredCognitiveLoad { get; set; } = CognitiveLoad.Medium;
    public int? AiEstimatedEnergyAtSchedule { get; set; }
    public TaskContext Context { get; set; } = TaskContext.Anywhere;
    public int UserPriority { get; set; } = 3;
    public double AiPriorityScore { get; set; }
    public string? AiPriorityRationale { get; set; }
    public bool IsShariaOrFamilyDuty { get; set; }
    public bool IsAiDecisionVetoedByUser { get; set; }
    public string? AiOverloadWarning { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool WasCompletedOnTime { get; set; }
    public string? CompletionNote { get; set; }
    // Cost & Assignment (Phase 3)
    public decimal? Cost { get; set; }
    public string? CostCurrency { get; set; } = "SAR";
    public Guid? AssignedToId { get; set; }
    public Guid? ProjectId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ApplicationUser? AssignedTo { get; set; }
    public LifeCircle LifeCircle { get; set; } = default!;
    public Goal? Goal { get; set; }
    public Project? Project { get; set; }
    public SmartTask? ParentTask { get; set; }
    public ICollection<SmartTask> SubTasks { get; set; } = [];
    public ICollection<TaskTag> Tags { get; set; } = [];
    public ICollection<TaskAttachment> Attachments { get; set; } = [];
    public ICollection<TaskAiLog> AiLogs { get; set; } = [];
}

public class TaskAiLog
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public DateTime LoggedAt { get; set; } = DateTime.UtcNow;
    public string ActionType { get; set; } = default!;
    public string Explanation { get; set; } = default!;
    public double? ScoreBefore { get; set; }
    public double? ScoreAfter { get; set; }
    public bool WasVetoed { get; set; }
    public SmartTask Task { get; set; } = default!;
}

public class TaskTag
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = default!;
    public string? ColorHex { get; set; }
    public ICollection<SmartTask> Tasks { get; set; } = [];
}

public class TaskAttachment
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public string FileName { get; set; } = default!;
    public string StorageUrl { get; set; } = default!;
    public long FileSizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public SmartTask Task { get; set; } = default!;
}
