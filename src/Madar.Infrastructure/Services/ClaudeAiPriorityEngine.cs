using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Madar.Application.Interfaces;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;
using Madar.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Madar.Infrastructure.Services;

public class ClaudeAiPriorityEngine : IAiPriorityEngine
{
    private readonly HttpClient _http;
    private readonly ISalahTimeService _salahService;
    private readonly ILogger<ClaudeAiPriorityEngine> _logger;
    private readonly string _apiKey;
    private const string ApiUrl = "https://api.anthropic.com/v1/messages";
    private const string Model = "claude-sonnet-4-5";

    public ClaudeAiPriorityEngine(HttpClient http, ISalahTimeService salahService,
        IConfiguration config, ILogger<ClaudeAiPriorityEngine> logger)
    {
        _http = http;
        _salahService = salahService;
        _logger = logger;
        _apiKey = config["Anthropic:ApiKey"] ?? throw new InvalidOperationException("Anthropic:ApiKey not configured");
    }

    public async Task<AiTaskAnalysis> AnalyzeTaskAsync(SmartTask task, ApplicationUser user, CancellationToken ct = default)
    {
        var salahTimes = await _salahService.GetTimesAsync(
            user.Latitude ?? "24.7136", user.Longitude ?? "46.6753",
            DateOnly.FromDateTime(DateTime.Today),
            user.PrayerCalculationMethod, ct);

        var systemPrompt = """
            أنت محرك الذكاء الاصطناعي لنظام "مدار" — نظام ERP شخصي وتنفيذي.
            مهمتك: تجيب دائماً بـ JSON فقط بدون أي نص إضافي.
            """;

        var userPrompt = $$"""
            حلل هذه المهمة وأعطني تحليلاً دقيقاً:

            المهمة: {{task.Title}}
            الوصف: {{task.Description ?? "لا يوجد"}}
            دائرة الحياة: {{task.LifeCircle?.Name ?? "غير محددة"}} (المستوى: {{task.LifeCircle?.Tier}})
            واجب شرعي/عائلي: {{(task.IsShariaOrFamilyDuty ? "نعم" : "لا")}}
            الأولوية من المستخدم: {{task.UserPriority}}/5
            الحمل المعرفي المطلوب: {{task.RequiredCognitiveLoad}}
            الموعد النهائي: {{task.DueDate?.ToString("yyyy-MM-dd") ?? "غير محدد"}}
            السياق: {{task.Context}}

            أوقات الصلاة اليوم:
            - الفجر: {{salahTimes.Fajr}}، الشروق: {{salahTimes.Shuruq}}
            - الظهر: {{salahTimes.Dhuhr}}، العصر: {{salahTimes.Asr}}
            - المغرب: {{salahTimes.Maghrib}}، العشاء: {{salahTimes.Isha}}

            ملف طاقة المستخدم:
            - الذروة الأولى: {{user.EnergyProfile.PeakEnergyBlock}}
            - الذروة الثانية: {{user.EnergyProfile.SecondaryEnergyBlock}}
            - فترة الانخفاض: {{user.EnergyProfile.LowEnergyBlock}}
            - النمط: {{user.EnergyProfile.Chronotype}}

            أعطني JSON بهذا الشكل بالضبط:
            {
              "priorityScore": <0-100>,
              "rationale": "<شرح باللغة العربية في جملتين>",
              "suggestedBlock": "<PostFajr|Duha|PostDhuhr|PostAsr|PostMaghrib|PostIsha>",
              "overloadWarning": "<تحذير إن وجد أو null>",
              "requiresUserConfirmation": <true|false>
            }
            """;

        var result = await CallClaudeAsync(systemPrompt, userPrompt, ct);

        try
        {
            var json = JsonSerializer.Deserialize<JsonElement>(result);
            return new AiTaskAnalysis(
                PriorityScore: json.GetProperty("priorityScore").GetDouble(),
                Rationale: json.GetProperty("rationale").GetString()!,
                OverloadWarning: json.TryGetProperty("overloadWarning", out var w) && w.ValueKind != JsonValueKind.Null ? w.GetString() : null,
                SuggestedBlock: Enum.Parse<SalahBlock>(json.GetProperty("suggestedBlock").GetString()!),
                RequiresUserConfirmation: json.GetProperty("requiresUserConfirmation").GetBoolean()
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse Claude response: {Response}", result);
            return new AiTaskAnalysis(50, "تعذّر التحليل التلقائي، يُرجى المراجعة يدوياً.", null, SalahBlock.PostDhuhr, false);
        }
    }

    public async Task<string> ExplainDecisionAsync(Guid taskId, string language = "ar", CancellationToken ct = default)
    {
        var prompt = language == "ar"
            ? $"اشرح لي بأسلوب بسيط لماذا جدولت نظام مدار المهمة رقم {taskId} في هذا الوقت وبهذه الأولوية."
            : $"Explain in simple terms why Madar scheduled task {taskId} at this time with this priority.";

        return await CallClaudeAsync("أنت مساعد تخطيط ذكي يشرح قراراته بوضوح وتواضع.", prompt, ct);
    }

    public async Task<AiScheduleSuggestion> SuggestScheduleAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        // Simplified — full implementation fetches all user tasks for the day
        return new AiScheduleSuggestion([], "جارٍ تطوير هذه الميزة.", []);
    }

    private async Task<string> CallClaudeAsync(string system, string userMessage, CancellationToken ct)
    {
        var body = new
        {
            model = Model,
            max_tokens = 1024,
            system,
            messages = new[] { new { role = "user", content = userMessage } }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl);
        request.Headers.Add("x-api-key", _apiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");
        request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        return json.GetProperty("content")[0].GetProperty("text").GetString()!;
    }
}
