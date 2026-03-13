using Madar.Domain.Enums;

namespace Madar.Application.DTOs.AI;

public record TaskPriorityRequest(
    Guid TaskId,
    string Title,
    string? Description,
    int UserPriority,
    CognitiveLoad RequiredCognitiveLoad,
    bool IsShariaOrFamilyDuty,
    DateTime? DueDate,
    bool IsRecurring,
    string? GoalTitle,
    string? LifeCircleName,
    CircleTier CircleTier,
    // User energy context
    SalahBlock PeakEnergyBlock,
    SalahBlock CurrentTimeBlock,
    int CurrentEnergyLevel,      // 1-10 from DailyEnergyLog
    bool IsFastingToday,
    Chronotype Chronotype
);

public record TaskPriorityResult(
    Guid TaskId,
    double AiPriorityScore,      // 0.0 – 10.0
    string Rationale,
    SalahBlock? RecommendedBlock,
    string? OverloadWarning,
    bool WasThinkingUsed
);
