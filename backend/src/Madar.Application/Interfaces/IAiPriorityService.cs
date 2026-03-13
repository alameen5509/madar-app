using Madar.Application.Common.Models;
using Madar.Application.DTOs.AI;

namespace Madar.Application.Interfaces;

public interface IAiPriorityService
{
    /// <summary>
    /// Scores a single task using the Claude AI Priority Engine.
    /// </summary>
    Task<Result<TaskPriorityResult>> ScoreTaskAsync(
        TaskPriorityRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Scores a batch of tasks and returns ranked results.
    /// </summary>
    Task<Result<IReadOnlyList<TaskPriorityResult>>> ScoreBatchAsync(
        IEnumerable<TaskPriorityRequest> requests,
        CancellationToken cancellationToken = default);
}
