using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        // Auto-generate title from first line
        var firstLine = userRequest.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? userRequest;
        var title = firstLine.Length > 60 ? firstLine[..60] + "..." : firstLine;

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

            var systemPrompt = $@"You are an expert senior developer working on the Madar project — a comprehensive Arabic life management system.

TECH STACK:
- Frontend: Next.js 16 + TypeScript + Tailwind CSS v4 → Vercel (madar-web-ten.vercel.app)
- Backend: ASP.NET Core 10, Clean Architecture → Azure (madar-api-app.azurewebsites.net)
- Database: TiDB Cloud (MySQL) via Pomelo EF Core
- Auth: JWT + ASP.NET Identity
- Repo: D:\PROGRAM\mdar (GitHub: alameen5509/madar-app)

PROJECT STRUCTURE:
- frontend/src/app/ → Next.js pages
- frontend/src/components/ → Shared components (Sidebar.tsx, etc.)
- frontend/src/lib/api.ts → Axios API client
- backend/src/Madar.API/Controllers/ → API Controllers
- backend/src/Madar.Application/ → DTOs, Interfaces, Services
- backend/src/Madar.Domain/ → Entities
- backend/src/Madar.Infrastructure/ → EF Core, Persistence

DESIGN SYSTEM:
- RTL Arabic UI
- Colors: Purple #5E5495, Gold #C9A84C, Teal #2ABFBF, Red #E07C6F, Green #5ABF7C
- Fonts: Cairo, Amiri

CRITICAL RULES FOR GENERATED COMMANDS:
1. ALWAYS read existing files before modifying them
2. NEVER break existing functionality to fix something new
3. Make surgical changes — touch only what's needed
4. If DB changes needed: add migrations, never drop existing columns
5. If API changes needed: add new endpoints, don't remove old ones
6. Test after each change
7. Always deploy at the end: push to GitHub + deploy backend to Azure

OUTPUT FORMAT (always in English):
- Start with: ## Summary of Changes
- Then: ## Files to Modify (list exact file paths)
- Then: ## Step-by-Step Instructions (numbered, detailed)
- Then: ## Database Changes (if any — SQL migrations)
- Then: ## Deployment
- End with: ## Verification Steps (how to confirm it works)

USER REQUEST: {userInput}
CONTEXT: {(string.IsNullOrEmpty(projectContext) ? "None" : projectContext)}
PREVIOUS TICKETS: {(string.IsNullOrEmpty(historyContext) ? "None" : historyContext)}
SCREENSHOTS: (see user message if any)";

            if (!string.IsNullOrEmpty(extraInstruction))
                systemPrompt += "\n\nADDITIONAL INSTRUCTION: " + extraInstruction;

            var body = new
            {
                model = "claude-sonnet-4-5",
                max_tokens = 4000,
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
