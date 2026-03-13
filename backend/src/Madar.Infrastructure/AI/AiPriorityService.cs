using System.Text.Json;
using Anthropic.SDK;
using Anthropic.SDK.Common;
using Anthropic.SDK.Constants;
using Anthropic.SDK.Messaging;
using Madar.Application.Common.Models;
using Madar.Application.DTOs.AI;
using Madar.Application.Interfaces;
using Madar.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Madar.Infrastructure.AI;

public class AiPriorityService : IAiPriorityService
{
    private readonly AnthropicClient _client;
    private readonly ILogger<AiPriorityService> _logger;

    private static readonly string PriorityToolSchema = JsonSerializer.Serialize(new
    {
        type = "object",
        properties = new
        {
            priority_score = new { type = "number", description = "Priority score from 0.0 to 10.0. Higher = more urgent/important." },
            rationale = new { type = "string", description = "One or two sentences explaining the priority decision in terms of Islamic life balance, energy alignment, and goal impact." },
            recommended_block = new
            {
                type = "string",
                description = "The Salah block best suited for this task. Null if no recommendation.",
                @enum = new[] { "PreFajr", "PostFajr", "Duha", "PostDhuhr", "PostAsr", "PostMaghrib", "PostIsha", "Overnight" }
            },
            overload_warning = new { type = "string", description = "Warning if the task may cause cognitive or physical overload. Null if none." },
        },
        required = new[] { "priority_score", "rationale" }
    });

    public AiPriorityService(AnthropicClient client, ILogger<AiPriorityService> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<Result<TaskPriorityResult>> ScoreTaskAsync(
        TaskPriorityRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var prompt = BuildPrompt(request);

            var tools = new List<Anthropic.SDK.Common.Tool>
            {
                new Function("set_task_priority",
                    "Set the AI-calculated priority score and scheduling recommendation for a task.",
                    System.Text.Json.Nodes.JsonNode.Parse(PriorityToolSchema))
            };

            var parameters = new MessageParameters
            {
                Messages = new List<Message>
                {
                    new Message(RoleType.User, prompt)
                },
                MaxTokens = 2048,
                Model = AnthropicModels.Claude35Sonnet,
                Stream = false,
                Temperature = 1.0m,
                Tools = tools,
                ToolChoice = new ToolChoice
                {
                    Type = ToolChoiceType.Tool,
                    Name = "set_task_priority"
                }
            };

            var response = await _client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);

            var toolUseContent = response.Content.OfType<ToolUseContent>().FirstOrDefault();

            if (toolUseContent is null)
                return Result<TaskPriorityResult>.Failure("AI engine did not return a priority result.");

            var result = ParseToolOutput(request.TaskId, toolUseContent.Input);
            return Result<TaskPriorityResult>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to score task {TaskId} with AI Priority Engine", request.TaskId);
            return Result<TaskPriorityResult>.Failure($"AI scoring failed: {ex.Message}");
        }
    }

    public async Task<Result<IReadOnlyList<TaskPriorityResult>>> ScoreBatchAsync(
        IEnumerable<TaskPriorityRequest> requests,
        CancellationToken cancellationToken = default)
    {
        var results = new List<TaskPriorityResult>();
        var errors = new List<string>();

        var semaphore = new SemaphoreSlim(3, 3);
        var tasks = requests.Select(async req =>
        {
            await semaphore.WaitAsync(cancellationToken);
            try
            {
                var result = await ScoreTaskAsync(req, cancellationToken);
                if (result.Succeeded && result.Data is not null)
                    results.Add(result.Data);
                else
                    errors.AddRange(result.Errors);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);

        if (errors.Count > 0)
            _logger.LogWarning("Batch scoring completed with {ErrorCount} errors: {Errors}",
                errors.Count, string.Join("; ", errors));

        var sorted = results.OrderByDescending(r => r.AiPriorityScore).ToList();
        return Result<IReadOnlyList<TaskPriorityResult>>.Success(sorted);
    }

    // ─── Private Helpers ────────────────────────────────────────────────────────

    private static string BuildPrompt(TaskPriorityRequest r)
    {
        var dueDateInfo = r.DueDate.HasValue
            ? $"Due: {r.DueDate.Value:yyyy-MM-dd} ({(r.DueDate.Value - DateTime.UtcNow).Days} days away)"
            : "No due date";

        return $"""
            You are the Madar AI Priority Engine — an Islamic productivity assistant that scores tasks
            based on Sharia priorities, user energy levels, circadian patterns, and life goals.

            ## Scoring Principles (in order of weight)
            1. Sharia/family obligations always score high (7.5–10.0)
            2. Alignment with active goals and life circles
            3. Deadline urgency and time sensitivity
            4. Match between task cognitive load and user's current energy state
            5. Recurrence value (habits that build character)

            ## Task Context
            - Title: {r.Title}
            - Description: {r.Description ?? "N/A"}
            - Circle: {r.LifeCircleName ?? "N/A"} (Tier: {r.CircleTier})
            - Goal: {r.GoalTitle ?? "No linked goal"}
            - User Priority: {r.UserPriority}/5
            - Cognitive Load Required: {r.RequiredCognitiveLoad}
            - Sharia/Family Duty: {r.IsShariaOrFamilyDuty}
            - Recurring: {r.IsRecurring}
            - {dueDateInfo}

            ## User Energy Profile (right now)
            - Chronotype: {r.Chronotype}
            - Peak Energy Block: {r.PeakEnergyBlock}
            - Current Time Block: {r.CurrentTimeBlock}
            - Current Energy Level: {r.CurrentEnergyLevel}/10
            - Fasting Today: {r.IsFastingToday}

            Score this task and recommend the best Salah block for scheduling it.
            Call the set_task_priority tool with your assessment.
            """;
    }

    private static TaskPriorityResult ParseToolOutput(Guid taskId, System.Text.Json.Nodes.JsonNode? input)
    {
        if (input is null)
            return new TaskPriorityResult(taskId, 5.0, string.Empty, null, null, false);

        var json = JsonSerializer.Deserialize<JsonElement>(input.ToJsonString());

        var score = json.TryGetProperty("priority_score", out var scoreEl)
            ? Math.Clamp(scoreEl.GetDouble(), 0.0, 10.0)
            : 5.0;

        var rationale = json.TryGetProperty("rationale", out var ratEl)
            ? ratEl.GetString() ?? string.Empty
            : string.Empty;

        SalahBlock? recommendedBlock = null;
        if (json.TryGetProperty("recommended_block", out var blockEl) &&
            blockEl.ValueKind != JsonValueKind.Null &&
            Enum.TryParse<SalahBlock>(blockEl.GetString(), out var parsedBlock))
        {
            recommendedBlock = parsedBlock;
        }

        var overloadWarning = json.TryGetProperty("overload_warning", out var warnEl) &&
                              warnEl.ValueKind != JsonValueKind.Null
            ? warnEl.GetString()
            : null;

        return new TaskPriorityResult(
            TaskId: taskId,
            AiPriorityScore: score,
            Rationale: rationale,
            RecommendedBlock: recommendedBlock,
            OverloadWarning: overloadWarning,
            WasThinkingUsed: false
        );
    }
}
