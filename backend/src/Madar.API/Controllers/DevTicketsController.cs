using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/dev-tickets")]
public class DevTicketsController : ControllerBase
{
    private readonly MadarDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    public DevTicketsController(MadarDbContext db, IConfiguration config, IHttpClientFactory httpFactory)
    { _db = db; _config = config; _httpFactory = httpFactory; }

    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ─── List ─────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await Q(@"SELECT * FROM DevTickets WHERE UserId=@uid ORDER BY
            CASE Status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
            CreatedAt DESC",
            [new("@uid", Uid)], ct);
        return Ok(rows);
    }

    // ─── Create ───────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        var userRequest = req.UserRequest?.Trim();
        if (string.IsNullOrEmpty(userRequest)) return BadRequest(new { error = "الطلب مطلوب" });
        var title = req.Title?.Trim();
        if (string.IsNullOrEmpty(title)) title = userRequest.Length > 60 ? userRequest[..60] + "..." : userRequest;

        var aiCommand = await GenerateCommand(userRequest, null, Uid, ct);
        var screenshots = req.Screenshots != null ? JsonSerializer.Serialize(req.Screenshots) : null;

        await E(@"INSERT INTO DevTickets (Id,UserId,Title,UserRequest,Screenshots,AiCommand,Status,Attempts,CreatedAt,UpdatedAt)
            VALUES(@id,@uid,@t,@ur,@sc,@ai,'open',1,NOW(),NOW())",
            [new("@id",id),new("@uid",Uid),new("@t",title),new("@ur",userRequest),
             new("@sc",(object?)screenshots??DBNull.Value),new("@ai",aiCommand)], ct);

        await E(@"INSERT INTO DevTicketHistory (Id,TicketId,Command,Notes,Status,CreatedAt)
            VALUES(@hid,@tid,@cmd,'طلب أولي','open',NOW())",
            [new("@hid",Guid.NewGuid().ToString()),new("@tid",id),new("@cmd",aiCommand)], ct);

        return Ok(new { id, title, userRequest, screenshots, aiCommand, status = "open", attempts = 1 });
    }

    // ─── Resolve ──────────────────────────────────────────────────────
    [HttpPatch("{id}/resolve")]
    public async Task<IActionResult> Resolve(string id, CancellationToken ct)
    {
        var rows = await E(@"UPDATE DevTickets SET Status='resolved', ResolvedAt=NOW(), UpdatedAt=NOW()
            WHERE Id=@id AND UserId=@uid",
            [new("@id",id),new("@uid",Uid)], ct);
        if (rows == 0) return NotFound();
        await E(@"INSERT INTO DevTicketHistory (Id,TicketId,Notes,Status,CreatedAt)
            VALUES(@hid,@tid,'تم الحل','resolved',NOW())",
            [new("@hid",Guid.NewGuid().ToString()),new("@tid",id)], ct);
        return Ok(new { id, status = "resolved" });
    }

    // ─── Retry ────────────────────────────────────────────────────────
    [HttpPatch("{id}/retry")]
    public async Task<IActionResult> Retry(string id, [FromBody] RetryReq req, CancellationToken ct)
    {
        var tickets = await Q("SELECT UserRequest, AiCommand, Attempts FROM DevTickets WHERE Id=@id AND UserId=@uid",
            [new("@id",id),new("@uid",Uid)], ct);
        if (tickets.Count == 0) return NotFound();

        var original = tickets[0]["userRequest"]?.ToString() ?? "";
        var prevCommand = tickets[0]["aiCommand"]?.ToString() ?? "";
        var attempts = Convert.ToInt32(tickets[0]["attempts"] ?? 1);
        var notes = req.Notes?.Trim() ?? "";

        var context = $"الطلب الأصلي: {original}\n\nالأمر السابق:\n{prevCommand}\n\nملاحظة المستخدم (لم ينجح): {notes}";
        var aiCommand = await GenerateCommand(context, "المستخدم جرّب الأمر السابق ولم ينجح. حسّن الأمر بناءً على ملاحظته.", Uid, ct);

        await E(@"UPDATE DevTickets SET AiCommand=@ai, Status='open', Attempts=@a, Notes=@n, UpdatedAt=NOW()
            WHERE Id=@id AND UserId=@uid",
            [new("@id",id),new("@uid",Uid),new("@ai",aiCommand),new("@a",attempts+1),new("@n",notes)], ct);

        await E(@"INSERT INTO DevTicketHistory (Id,TicketId,Command,Notes,Status,CreatedAt)
            VALUES(@hid,@tid,@cmd,@n,'open',NOW())",
            [new("@hid",Guid.NewGuid().ToString()),new("@tid",id),new("@cmd",aiCommand),new("@n",notes)], ct);

        return Ok(new { id, aiCommand, status = "open", attempts = attempts + 1 });
    }

    // ─── Context ──────────────────────────────────────────────────────
    [HttpGet("context")]
    public async Task<IActionResult> GetContext(CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM DevContext WHERE UserId=@uid AND IsActive=1 LIMIT 1",
            [new("@uid", Uid)], ct);
        return Ok(rows.Count > 0 ? rows[0] : new Dictionary<string, object?> { ["content"] = "" });
    }

    [HttpPut("context")]
    public async Task<IActionResult> SaveContext([FromBody] ContextReq req, CancellationToken ct)
    {
        var existing = await Q("SELECT Id FROM DevContext WHERE UserId=@uid AND IsActive=1 LIMIT 1",
            [new("@uid", Uid)], ct);
        if (existing.Count > 0)
        {
            await E("UPDATE DevContext SET Content=@c, UpdatedAt=NOW() WHERE Id=@id",
                [new("@id", existing[0]["id"]!.ToString()!), new("@c", req.Content ?? "")], ct);
        }
        else
        {
            await E("INSERT INTO DevContext (Id,UserId,Content,IsActive,UpdatedAt) VALUES(@id,@uid,@c,1,NOW())",
                [new("@id", Guid.NewGuid().ToString()), new("@uid", Uid), new("@c", req.Content ?? "")], ct);
        }
        return Ok(new { saved = true });
    }

    // ─── AI Generation ────────────────────────────────────────────────
    private async Task<string> GenerateCommand(string userInput, string? extraInstruction, string userId, CancellationToken ct)
    {
        var apiKey = _config["Anthropic:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_CLAUDE_API_KEY_HERE")
            return $"[AI غير متاح] الطلب: {userInput}";

        // Gather context
        var contextRows = await Q("SELECT Content FROM DevContext WHERE UserId=@uid AND IsActive=1 LIMIT 1",
            [new("@uid", userId)], ct);
        var projectContext = contextRows.Count > 0 ? contextRows[0]["content"]?.ToString() ?? "" : "";

        var recentSolved = await Q(@"SELECT Title, UserRequest, AiCommand FROM DevTickets
            WHERE UserId=@uid AND Status='resolved' ORDER BY ResolvedAt DESC LIMIT 5",
            [new("@uid", userId)], ct);
        var historyContext = string.Join("\n", recentSolved.Select(r =>
            $"- {r["title"]}: {r["userRequest"]?.ToString()?.Substring(0, Math.Min(100, r["userRequest"]?.ToString()?.Length ?? 0))}"));

        try
        {
            var http = _httpFactory.CreateClient();
            http.DefaultRequestHeaders.Add("x-api-key", apiKey);
            http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

            var systemPrompt = $@"أنت مساعد تطوير متخصص في مشروع مدار.

سياق المشروع:
- Frontend: Next.js + TypeScript + Tailwind (يُنشر على Vercel أو محلياً)
- Backend: ASP.NET Core 9 على Azure App Service
- DB: TiDB Cloud (MySQL compatible)
- التصميم: ألوان مدار (#5E5495 بنفسجي، #C9A84C/#D4AF37 ذهبي، #2ABFBF تركوازي)، RTL عربي
- المسار: D:\PROGRAM\mdar (frontend/ و backend/)

{(string.IsNullOrEmpty(historyContext) ? "" : $"القرارات السابقة:\n{historyContext}\n")}
{(string.IsNullOrEmpty(projectContext) ? "" : $"سياق إضافي:\n{projectContext}\n")}

مهمتك: حوّل طلب المستخدم إلى أمر مفصل لـ Claude Code.
القواعد:
- الأمر يكون بالعربي
- يكون مفصلاً خطوة بخطوة
- يذكر الملفات المتوقع تعديلها
- يذكر تغييرات DB إذا لزم
- ينتهي بـ ""ادفع لـ GitHub وانشر""
- لا تكتب كود — فقط التعليمات";

            if (!string.IsNullOrEmpty(extraInstruction))
                systemPrompt += "\n\n" + extraInstruction;

            var body = new
            {
                model = "claude-sonnet-4-5",
                max_tokens = 2000,
                system = systemPrompt,
                messages = new[] { new { role = "user", content = userInput } }
            };

            var resp = await http.PostAsync("https://api.anthropic.com/v1/messages",
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"), ct);

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var text = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString();
            return text ?? userInput;
        }
        catch (Exception ex)
        {
            return $"[خطأ في التوليد: {ex.Message}]\n\nالطلب الأصلي: {userInput}";
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct);
            var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < r.FieldCount; i++)
                    row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }
}

public class CreateTicketReq { public string? Title { get; set; } public string? UserRequest { get; set; } public List<string>? Screenshots { get; set; } }
public class RetryReq { public string? Notes { get; set; } public List<string>? Screenshots { get; set; } }
public class ContextReq { public string? Content { get; set; } }
