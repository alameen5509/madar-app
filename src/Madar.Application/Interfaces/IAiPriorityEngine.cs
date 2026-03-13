using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;

namespace Madar.Application.Interfaces;

public interface IAiPriorityEngine
{
    Task<AiTaskAnalysis> AnalyzeTaskAsync(SmartTask task, ApplicationUser user, CancellationToken ct = default);
    Task<AiScheduleSuggestion> SuggestScheduleAsync(Guid userId, DateOnly date, CancellationToken ct = default);
    Task<string> ExplainDecisionAsync(Guid taskId, string language = "ar", CancellationToken ct = default);
}

public record AiTaskAnalysis(
    double PriorityScore,
    string Rationale,
    string? OverloadWarning,
    Domain.Enums.SalahBlock SuggestedBlock,
    bool RequiresUserConfirmation
);

public record AiScheduleSuggestion(
    List<ScheduledSlot> Slots,
    string DailySummary,
    List<string> Warnings
);

public record ScheduledSlot(
    Guid TaskId,
    Domain.Enums.SalahBlock Block,
    int StartOffsetMinutes,
    int DurationMinutes,
    string Rationale
);
