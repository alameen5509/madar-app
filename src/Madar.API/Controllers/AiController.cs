using Madar.Application.Interfaces;
using Madar.Domain.Entities.Core;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiPriorityEngine _ai;
    private readonly MadarDbContext _db;

    public AiController(IAiPriorityEngine ai, MadarDbContext db)
    {
        _ai = ai;
        _db = db;
    }

    /// <summary>
    /// تحليل مهمة واحدة بالذكاء الاصطناعي وإعطاء أولوية + وقت صلاة مقترح
    /// </summary>
    [HttpPost("analyze-task/{taskId}")]
    public async Task<IActionResult> AnalyzeTask(Guid taskId, CancellationToken ct)
    {
        var task = await _db.SmartTasks
            .Include(t => t.LifeCircle)
            .Include(t => t.Owner)
            .FirstOrDefaultAsync(t => t.Id == taskId, ct);

        if (task is null) return NotFound();

        var analysis = await _ai.AnalyzeTaskAsync(task, task.Owner, ct);

        // Persist AI results back to task
        task.AiPriorityScore = analysis.PriorityScore;
        task.AiPriorityRationale = analysis.Rationale;
        task.AiOverloadWarning = analysis.OverloadWarning;
        task.PreferredSalahBlock = analysis.SuggestedBlock;
        task.UpdatedAt = DateTime.UtcNow;

        // Log the AI decision
        _db.TaskAiLogs.Add(new TaskAiLog
        {
            TaskId = taskId,
            ActionType = "PriorityScore",
            Explanation = analysis.Rationale,
            ScoreAfter = analysis.PriorityScore,
            WasVetoed = false
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            taskId,
            analysis.PriorityScore,
            analysis.Rationale,
            analysis.SuggestedBlock,
            analysis.OverloadWarning,
            analysis.RequiresUserConfirmation
        });
    }

    /// <summary>
    /// المستخدم يرفض قرار الذكاء الاصطناعي (Veto)
    /// </summary>
    [HttpPost("veto/{taskId}")]
    public async Task<IActionResult> VetoAiDecision(Guid taskId, [FromBody] VetoRequest req, CancellationToken ct)
    {
        var task = await _db.SmartTasks.FindAsync([taskId], ct);
        if (task is null) return NotFound();

        task.IsAiDecisionVetoedByUser = true;
        task.PreferredSalahBlock = req.UserChosenBlock;
        task.UpdatedAt = DateTime.UtcNow;

        _db.TaskAiLogs.Add(new TaskAiLog
        {
            TaskId = taskId,
            ActionType = "UserVeto",
            Explanation = $"المستخدم رفض القرار واختار: {req.UserChosenBlock}. السبب: {req.Reason ?? "لم يُحدد"}",
            ScoreBefore = task.AiPriorityScore,
            WasVetoed = true
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم تسجيل رفض المستخدم بنجاح" });
    }

    /// <summary>
    /// شرح قرار الذكاء الاصطناعي لمهمة معينة (Learning Mode)
    /// </summary>
    [HttpGet("explain/{taskId}")]
    public async Task<IActionResult> ExplainDecision(Guid taskId, [FromQuery] string lang = "ar", CancellationToken ct = default)
    {
        var explanation = await _ai.ExplainDecisionAsync(taskId, lang, ct);
        return Ok(new { taskId, explanation });
    }
}

public record VetoRequest(SalahBlock UserChosenBlock, string? Reason);
