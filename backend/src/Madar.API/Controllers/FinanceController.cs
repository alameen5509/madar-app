using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/finance")]
public class FinanceController : ControllerBase
{
    private readonly MadarDbContext _db;
    public FinanceController(MadarDbContext db) => _db = db;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ═══ Snapshot — تحميل كل البيانات المالية في طلب واحد ═══
    [HttpGet("snapshot")]
    public async Task<IActionResult> GetSnapshot(CancellationToken ct)
    {
        var uid = UserId;
        var accounts = await _db.FinAccounts.Where(x => x.OwnerId == uid).OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        var pockets = await _db.FinPockets.Where(x => x.OwnerId == uid).Include(p => p.Commitments).OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        var transactions = await _db.FinTransactions.Where(x => x.OwnerId == uid).OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).ToListAsync(ct);
        var debts = await _db.FinDebts.Where(x => x.OwnerId == uid).OrderBy(x => x.CreatedAt).ToListAsync(ct);
        var dues = await _db.FinRecurringDues.Where(x => x.OwnerId == uid).OrderBy(x => x.DueDay).ToListAsync(ct);
        var goals = await _db.FinGoals.Where(x => x.OwnerId == uid).Include(g => g.Items).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var zakat = await _db.ZakatProfiles.Where(x => x.OwnerId == uid).Include(z => z.GoldPurchases).FirstOrDefaultAsync(ct);
        var settings = await _db.FinSettings.FirstOrDefaultAsync(x => x.OwnerId == uid, ct);

        return Ok(new
        {
            accounts = accounts.Select(a => new { a.Id, a.Name, a.Icon, a.Balance, a.DisplayOrder }),
            pockets = pockets.Select(p => new
            {
                p.Id, p.Name, p.Icon, type = p.Type.ToString(), p.DisplayOrder,
                commitments = p.Commitments.Select(c => new { c.Id, c.Title, c.MonthlyAmount, c.TotalAmount, c.PaidSoFar, c.DueDay }),
            }),
            transactions = transactions.Select(t => new
            {
                t.Id, t.Title, t.Amount, type = t.Type.ToString(), t.Category,
                expenseClass = t.ExpenseClass?.ToString(), accountId = t.AccountId, pocketId = t.PocketId,
                date = t.Date.ToString("yyyy-MM-dd"), approvedAt = t.ApprovedAt?.ToString("yyyy-MM-dd"),
            }),
            debts = debts.Select(d => new { d.Id, d.CreditorName, d.CreditorPhone, d.OriginalAmount, d.PaidSoFar, d.MonthlyPayment, d.Notes, createdAt = d.CreatedAt.ToString("yyyy-MM-dd") }),
            dues = dues.Select(d => new
            {
                d.Id, d.Title, d.Amount, type = d.Type.ToString(), frequency = d.Frequency.ToString(),
                d.DueDay, d.DueMonth, d.AccountId, d.PocketId, d.Category, d.IsActive,
                lastConfirmedDate = d.LastConfirmedDate?.ToString("yyyy-MM-dd"),
            }),
            goals = goals.Select(g => new
            {
                g.Id, g.Title, g.Description, g.TargetAmount, g.SavedSoFar,
                deadline = g.Deadline?.ToString("yyyy-MM-dd"),
                items = g.Items.Select(i => new { i.Id, i.Name, i.Cost }),
            }),
            zakat = zakat == null ? null : new
            {
                zakat.HawalDate, zakat.GoldGrams,
                goldPurchases = zakat.GoldPurchases.OrderByDescending(p => p.Date).Select(p => new
                {
                    p.Id, p.Grams, p.PricePerGram, p.TotalCost, date = p.Date.ToString("yyyy-MM-dd"), p.Notes,
                }),
            },
            settings = settings == null ? null : new
            {
                settings.DebtPercent, settings.SavingsPercent,
                expenseCategories = System.Text.Json.JsonSerializer.Deserialize<string[]>(settings.ExpenseCategoriesJson),
                incomeCategories = System.Text.Json.JsonSerializer.Deserialize<string[]>(settings.IncomeCategoriesJson),
            },
        });
    }

    // ═══ Sync — رفع بيانات localStorage دفعة واحدة ═══
    [HttpPost("sync")]
    public async Task<IActionResult> Sync([FromBody] FinanceSyncRequest req, CancellationToken ct)
    {
        var uid = UserId;
        var idMap = new Dictionary<string, Guid>();

        // Accounts
        foreach (var a in req.Accounts ?? [])
        {
            var newId = Guid.NewGuid();
            idMap[a.Id] = newId;
            _db.FinAccounts.Add(new FinAccount { Id = newId, OwnerId = uid, Name = a.Name, Icon = a.Icon ?? "🏦", Balance = a.Balance, DisplayOrder = a.DisplayOrder });
        }

        // Pockets
        foreach (var p in req.Pockets ?? [])
        {
            var newId = Guid.NewGuid();
            idMap[p.Id] = newId;
            var pocket = new FinPocket { Id = newId, OwnerId = uid, Name = p.Name, Icon = p.Icon ?? "👤", DisplayOrder = p.DisplayOrder };
            if (Enum.TryParse<PocketType>(p.Type, true, out var pt)) pocket.Type = pt;
            _db.FinPockets.Add(pocket);
            foreach (var c in p.Commitments ?? [])
            {
                _db.PocketCommitments.Add(new PocketCommitment { Id = Guid.NewGuid(), PocketId = newId, Title = c.Title, MonthlyAmount = c.MonthlyAmount, TotalAmount = c.TotalAmount, PaidSoFar = c.PaidSoFar, DueDay = c.DueDay });
            }
        }

        // Transactions
        foreach (var t in req.Transactions ?? [])
        {
            var tx = new FinTransaction
            {
                Id = Guid.NewGuid(), OwnerId = uid, Title = t.Title, Amount = t.Amount, Category = t.Category ?? "أخرى",
                Date = DateTime.TryParse(t.Date, out var d) ? d : DateTime.UtcNow,
                AccountId = t.AccountId != null && idMap.TryGetValue(t.AccountId, out var aid) ? aid : null,
                PocketId = t.PocketId != null && idMap.TryGetValue(t.PocketId, out var pid) ? pid : null,
            };
            if (Enum.TryParse<FinTransactionType>(t.Type, true, out var tt)) tx.Type = tt;
            if (t.ExpenseClass != null && Enum.TryParse<ExpenseClass>(t.ExpenseClass, true, out var ec)) tx.ExpenseClass = ec;
            _db.FinTransactions.Add(tx);
        }

        // Debts
        foreach (var d in req.Debts ?? [])
        {
            _db.FinDebts.Add(new FinDebt { Id = Guid.NewGuid(), OwnerId = uid, CreditorName = d.CreditorName, CreditorPhone = d.CreditorPhone, OriginalAmount = d.OriginalAmount, PaidSoFar = d.PaidSoFar, MonthlyPayment = d.MonthlyPayment, Notes = d.Notes });
        }

        // Dues
        foreach (var d in req.Dues ?? [])
        {
            var due = new FinRecurringDue { Id = Guid.NewGuid(), OwnerId = uid, Title = d.Title, Amount = d.Amount, DueDay = d.DueDay, DueMonth = d.DueMonth, Category = d.Category, IsActive = d.IsActive };
            if (Enum.TryParse<DueType>(d.Type, true, out var dt)) due.Type = dt;
            if (Enum.TryParse<DueFrequency>(d.Frequency, true, out var df)) due.Frequency = df;
            if (d.AccountId != null && idMap.TryGetValue(d.AccountId, out var daid)) due.AccountId = daid;
            if (d.PocketId != null && idMap.TryGetValue(d.PocketId, out var dpid)) due.PocketId = dpid;
            _db.FinRecurringDues.Add(due);
        }

        // Goals
        foreach (var g in req.Goals ?? [])
        {
            var gid = Guid.NewGuid();
            _db.FinGoals.Add(new FinGoal { Id = gid, OwnerId = uid, Title = g.Title, Description = g.Description, TargetAmount = g.TargetAmount, SavedSoFar = g.SavedSoFar, Deadline = DateTime.TryParse(g.Deadline, out var gd) ? gd : null });
            foreach (var i in g.Items ?? [])
                _db.FinGoalItems.Add(new FinGoalItem { Id = Guid.NewGuid(), GoalId = gid, Name = i.Name, Cost = i.Cost });
        }

        // Zakat
        if (req.Zakat != null)
        {
            var zid = Guid.NewGuid();
            _db.ZakatProfiles.Add(new ZakatProfile { Id = zid, OwnerId = uid, HawalDate = req.Zakat.HawalDate, GoldGrams = req.Zakat.GoldGrams });
            foreach (var p in req.Zakat.GoldPurchases ?? [])
                _db.GoldPurchases.Add(new GoldPurchase { Id = Guid.NewGuid(), ZakatProfileId = zid, Grams = p.Grams, PricePerGram = p.PricePerGram, TotalCost = p.TotalCost, Date = DateTime.TryParse(p.Date, out var pd) ? pd : DateTime.UtcNow, Notes = p.Notes });
        }

        // Settings
        if (req.Settings != null)
        {
            _db.FinSettings.Add(new FinSettings
            {
                Id = Guid.NewGuid(), OwnerId = uid, DebtPercent = req.Settings.DebtPercent, SavingsPercent = req.Settings.SavingsPercent,
                ExpenseCategoriesJson = System.Text.Json.JsonSerializer.Serialize(req.Settings.ExpenseCategories ?? []),
                IncomeCategoriesJson = System.Text.Json.JsonSerializer.Serialize(req.Settings.IncomeCategories ?? []),
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم ترحيل البيانات المالية بنجاح", idMap });
    }

    // ═══ CRUD: Accounts ═══
    [HttpPost("accounts")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateAccountReq req, CancellationToken ct)
    {
        var a = new FinAccount { Id = Guid.NewGuid(), OwnerId = UserId, Name = req.Name, Icon = req.Icon ?? "🏦", Balance = req.Balance };
        _db.FinAccounts.Add(a);
        await _db.SaveChangesAsync(ct);
        return Ok(new { a.Id, a.Name, a.Icon, a.Balance });
    }

    [HttpPut("accounts/{id:guid}")]
    public async Task<IActionResult> UpdateAccount(Guid id, [FromBody] CreateAccountReq req, CancellationToken ct)
    {
        var a = await _db.FinAccounts.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (a is null) return NotFound();
        a.Name = req.Name; a.Icon = req.Icon ?? a.Icon; a.Balance = req.Balance;
        await _db.SaveChangesAsync(ct);
        return Ok(new { a.Id, a.Name, a.Icon, a.Balance });
    }

    [HttpDelete("accounts/{id:guid}")]
    public async Task<IActionResult> DeleteAccount(Guid id, CancellationToken ct)
    {
        var a = await _db.FinAccounts.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (a is null) return NotFound();
        _db.FinAccounts.Remove(a);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ CRUD: Transactions ═══
    [HttpPost("transactions")]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionReq req, CancellationToken ct)
    {
        var tx = new FinTransaction
        {
            Id = Guid.NewGuid(), OwnerId = UserId, Title = req.Title, Amount = req.Amount, Category = req.Category ?? "أخرى",
            Date = DateTime.TryParse(req.Date, out var d) ? d : DateTime.UtcNow, AccountId = req.AccountId, PocketId = req.PocketId,
        };
        if (Enum.TryParse<FinTransactionType>(req.Type, true, out var tt)) tx.Type = tt;
        if (req.ExpenseClass != null && Enum.TryParse<ExpenseClass>(req.ExpenseClass, true, out var ec)) tx.ExpenseClass = ec;
        _db.FinTransactions.Add(tx);
        await _db.SaveChangesAsync(ct);
        return Ok(new { tx.Id, tx.Title, tx.Amount, type = tx.Type.ToString(), tx.Category, tx.AccountId, tx.PocketId, date = tx.Date.ToString("yyyy-MM-dd") });
    }

    [HttpPut("transactions/{id:guid}")]
    public async Task<IActionResult> UpdateTransaction(Guid id, [FromBody] CreateTransactionReq req, CancellationToken ct)
    {
        var tx = await _db.FinTransactions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (tx is null) return NotFound();
        tx.Title = req.Title; tx.Amount = req.Amount; tx.Category = req.Category ?? tx.Category;
        if (DateTime.TryParse(req.Date, out var d)) tx.Date = d;
        if (Enum.TryParse<FinTransactionType>(req.Type, true, out var tt)) tx.Type = tt;
        if (req.ExpenseClass != null && Enum.TryParse<ExpenseClass>(req.ExpenseClass, true, out var ec)) tx.ExpenseClass = ec;
        tx.AccountId = req.AccountId; tx.PocketId = req.PocketId;
        await _db.SaveChangesAsync(ct);
        return Ok(new { tx.Id });
    }

    [HttpDelete("transactions/{id:guid}")]
    public async Task<IActionResult> DeleteTransaction(Guid id, CancellationToken ct)
    {
        var tx = await _db.FinTransactions.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (tx is null) return NotFound();
        _db.FinTransactions.Remove(tx);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ CRUD: Debts ═══
    [HttpPost("debts")]
    public async Task<IActionResult> CreateDebt([FromBody] CreateDebtReq req, CancellationToken ct)
    {
        var d = new FinDebt { Id = Guid.NewGuid(), OwnerId = UserId, CreditorName = req.CreditorName, CreditorPhone = req.CreditorPhone, OriginalAmount = req.OriginalAmount, PaidSoFar = req.PaidSoFar, MonthlyPayment = req.MonthlyPayment, Notes = req.Notes };
        _db.FinDebts.Add(d);
        await _db.SaveChangesAsync(ct);
        return Ok(new { d.Id });
    }

    [HttpPut("debts/{id:guid}")]
    public async Task<IActionResult> UpdateDebt(Guid id, [FromBody] CreateDebtReq req, CancellationToken ct)
    {
        var d = await _db.FinDebts.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (d is null) return NotFound();
        d.CreditorName = req.CreditorName; d.PaidSoFar = req.PaidSoFar; d.MonthlyPayment = req.MonthlyPayment; d.Notes = req.Notes;
        await _db.SaveChangesAsync(ct);
        return Ok(new { d.Id });
    }

    [HttpDelete("debts/{id:guid}")]
    public async Task<IActionResult> DeleteDebt(Guid id, CancellationToken ct)
    {
        var d = await _db.FinDebts.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (d is null) return NotFound();
        _db.FinDebts.Remove(d);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ CRUD: Goals ═══
    [HttpPost("goals")]
    public async Task<IActionResult> CreateGoal([FromBody] CreateGoalReq req, CancellationToken ct)
    {
        var g = new FinGoal { Id = Guid.NewGuid(), OwnerId = UserId, Title = req.Title, Description = req.Description, TargetAmount = req.TargetAmount, SavedSoFar = req.SavedSoFar, Deadline = DateTime.TryParse(req.Deadline, out var d) ? d : null };
        _db.FinGoals.Add(g);
        foreach (var i in req.Items ?? [])
            _db.FinGoalItems.Add(new FinGoalItem { Id = Guid.NewGuid(), GoalId = g.Id, Name = i.Name, Cost = i.Cost });
        await _db.SaveChangesAsync(ct);
        return Ok(new { g.Id });
    }

    [HttpPut("goals/{id:guid}")]
    public async Task<IActionResult> UpdateGoal(Guid id, [FromBody] CreateGoalReq req, CancellationToken ct)
    {
        var g = await _db.FinGoals.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (g is null) return NotFound();
        g.Title = req.Title; g.Description = req.Description; g.TargetAmount = req.TargetAmount; g.SavedSoFar = req.SavedSoFar;
        if (DateTime.TryParse(req.Deadline, out var d)) g.Deadline = d;
        _db.FinGoalItems.RemoveRange(g.Items);
        foreach (var i in req.Items ?? [])
            _db.FinGoalItems.Add(new FinGoalItem { Id = Guid.NewGuid(), GoalId = g.Id, Name = i.Name, Cost = i.Cost });
        await _db.SaveChangesAsync(ct);
        return Ok(new { g.Id });
    }

    [HttpDelete("goals/{id:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, CancellationToken ct)
    {
        var g = await _db.FinGoals.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (g is null) return NotFound();
        _db.FinGoals.Remove(g);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ Zakat ═══
    [HttpGet("zakat")]
    public async Task<IActionResult> GetZakat(CancellationToken ct)
    {
        var z = await _db.ZakatProfiles.Include(x => x.GoldPurchases).FirstOrDefaultAsync(x => x.OwnerId == UserId, ct);
        if (z is null) return Ok(new { hawalDate = "", goldGrams = 0m, goldPurchases = Array.Empty<object>() });
        return Ok(new { z.HawalDate, z.GoldGrams, goldPurchases = z.GoldPurchases.OrderByDescending(p => p.Date).Select(p => new { p.Id, p.Grams, p.PricePerGram, p.TotalCost, date = p.Date.ToString("yyyy-MM-dd"), p.Notes }) });
    }

    [HttpPut("zakat")]
    public async Task<IActionResult> UpdateZakat([FromBody] UpdateZakatReq req, CancellationToken ct)
    {
        var z = await _db.ZakatProfiles.FirstOrDefaultAsync(x => x.OwnerId == UserId, ct);
        if (z is null) { z = new ZakatProfile { Id = Guid.NewGuid(), OwnerId = UserId }; _db.ZakatProfiles.Add(z); }
        z.HawalDate = req.HawalDate; z.GoldGrams = req.GoldGrams;
        await _db.SaveChangesAsync(ct);
        return Ok(new { z.Id });
    }

    [HttpPost("zakat/purchases")]
    public async Task<IActionResult> AddGoldPurchase([FromBody] AddGoldPurchaseReq req, CancellationToken ct)
    {
        var z = await _db.ZakatProfiles.FirstOrDefaultAsync(x => x.OwnerId == UserId, ct);
        if (z is null) { z = new ZakatProfile { Id = Guid.NewGuid(), OwnerId = UserId }; _db.ZakatProfiles.Add(z); }
        z.GoldGrams += req.Grams;
        var p = new GoldPurchase { Id = Guid.NewGuid(), ZakatProfileId = z.Id, Grams = req.Grams, PricePerGram = req.PricePerGram, TotalCost = Math.Abs(req.Grams * req.PricePerGram), Date = DateTime.TryParse(req.Date, out var d) ? d : DateTime.UtcNow, Notes = req.Notes };
        _db.GoldPurchases.Add(p);
        await _db.SaveChangesAsync(ct);
        return Ok(new { p.Id, z.GoldGrams });
    }

    [HttpDelete("zakat/purchases/{id:guid}")]
    public async Task<IActionResult> DeleteGoldPurchase(Guid id, CancellationToken ct)
    {
        var p = await _db.GoldPurchases.Include(x => x.ZakatProfile).FirstOrDefaultAsync(x => x.Id == id && x.ZakatProfile.OwnerId == UserId, ct);
        if (p is null) return NotFound();
        p.ZakatProfile.GoldGrams -= p.Grams;
        _db.GoldPurchases.Remove(p);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ Settings ═══
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var s = await _db.FinSettings.FirstOrDefaultAsync(x => x.OwnerId == UserId, ct);
        if (s is null) return Ok(new { debtPercent = 10, savingsPercent = 10, expenseCategories = Array.Empty<string>(), incomeCategories = Array.Empty<string>() });
        return Ok(new { s.DebtPercent, s.SavingsPercent, expenseCategories = System.Text.Json.JsonSerializer.Deserialize<string[]>(s.ExpenseCategoriesJson), incomeCategories = System.Text.Json.JsonSerializer.Deserialize<string[]>(s.IncomeCategoriesJson) });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsReq req, CancellationToken ct)
    {
        var s = await _db.FinSettings.FirstOrDefaultAsync(x => x.OwnerId == UserId, ct);
        if (s is null) { s = new FinSettings { Id = Guid.NewGuid(), OwnerId = UserId }; _db.FinSettings.Add(s); }
        s.DebtPercent = req.DebtPercent; s.SavingsPercent = req.SavingsPercent;
        s.ExpenseCategoriesJson = System.Text.Json.JsonSerializer.Serialize(req.ExpenseCategories ?? []);
        s.IncomeCategoriesJson = System.Text.Json.JsonSerializer.Serialize(req.IncomeCategories ?? []);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحفظ" });
    }

    // ═══ CRUD: Dues ═══
    [HttpPost("dues")]
    public async Task<IActionResult> CreateDue([FromBody] CreateDueReq req, CancellationToken ct)
    {
        var d = new FinRecurringDue { Id = Guid.NewGuid(), OwnerId = UserId, Title = req.Title, Amount = req.Amount, DueDay = req.DueDay, DueMonth = req.DueMonth, Category = req.Category, IsActive = true };
        if (Enum.TryParse<DueType>(req.Type, true, out var dt)) d.Type = dt;
        if (Enum.TryParse<DueFrequency>(req.Frequency, true, out var df)) d.Frequency = df;
        d.AccountId = req.AccountId; d.PocketId = req.PocketId;
        _db.FinRecurringDues.Add(d);
        await _db.SaveChangesAsync(ct);
        return Ok(new { d.Id });
    }

    [HttpPut("dues/{id:guid}")]
    public async Task<IActionResult> UpdateDue(Guid id, [FromBody] CreateDueReq req, CancellationToken ct)
    {
        var d = await _db.FinRecurringDues.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (d is null) return NotFound();
        d.Title = req.Title; d.Amount = req.Amount; d.DueDay = req.DueDay;
        if (req.LastConfirmedDate != null) d.LastConfirmedDate = DateTime.TryParse(req.LastConfirmedDate, out var lcd) ? lcd : d.LastConfirmedDate;
        await _db.SaveChangesAsync(ct);
        return Ok(new { d.Id });
    }

    [HttpDelete("dues/{id:guid}")]
    public async Task<IActionResult> DeleteDue(Guid id, CancellationToken ct)
    {
        var d = await _db.FinRecurringDues.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (d is null) return NotFound();
        _db.FinRecurringDues.Remove(d);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ CRUD: Pockets ═══
    [HttpPost("pockets")]
    public async Task<IActionResult> CreatePocket([FromBody] CreatePocketReq req, CancellationToken ct)
    {
        var p = new FinPocket { Id = Guid.NewGuid(), OwnerId = UserId, Name = req.Name, Icon = req.Icon ?? "👤" };
        if (Enum.TryParse<PocketType>(req.Type, true, out var pt)) p.Type = pt;
        _db.FinPockets.Add(p);
        await _db.SaveChangesAsync(ct);
        return Ok(new { p.Id, p.Name, p.Icon, type = p.Type.ToString() });
    }

    [HttpDelete("pockets/{id:guid}")]
    public async Task<IActionResult> DeletePocket(Guid id, CancellationToken ct)
    {
        var p = await _db.FinPockets.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (p is null) return NotFound();
        _db.FinPockets.Remove(p);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }
}

// ═══ Request DTOs ═══
public record CreateAccountReq(string Name, string? Icon, decimal Balance, int DisplayOrder = 0);
public record CreatePocketReq(string Name, string? Icon, string? Type);
public record CreateTransactionReq(string Title, decimal Amount, string Type, string? Category, string? ExpenseClass, Guid? AccountId, Guid? PocketId, string? Date);
public record CreateDebtReq(string CreditorName, string? CreditorPhone, decimal OriginalAmount, decimal PaidSoFar, decimal MonthlyPayment, string? Notes);
public record CreateDueReq(string Title, decimal Amount, string Type, string Frequency, int DueDay, int? DueMonth, Guid? AccountId, Guid? PocketId, string? Category, string? LastConfirmedDate);
public record CreateGoalReq(string Title, string? Description, decimal TargetAmount, decimal SavedSoFar, string? Deadline, List<GoalItemReq>? Items);
public record GoalItemReq(string Name, decimal Cost);
public record UpdateZakatReq(string? HawalDate, decimal GoldGrams);
public record AddGoldPurchaseReq(decimal Grams, decimal PricePerGram, string? Date, string? Notes);
public record UpdateSettingsReq(int DebtPercent, int SavingsPercent, string[]? ExpenseCategories, string[]? IncomeCategories);

// Sync request
public class FinanceSyncRequest
{
    public List<SyncAccount>? Accounts { get; set; }
    public List<SyncPocket>? Pockets { get; set; }
    public List<SyncTransaction>? Transactions { get; set; }
    public List<SyncDebt>? Debts { get; set; }
    public List<SyncDue>? Dues { get; set; }
    public List<SyncGoal>? Goals { get; set; }
    public SyncZakat? Zakat { get; set; }
    public SyncSettings? Settings { get; set; }
}
public record SyncAccount(string Id, string Name, string? Icon, decimal Balance, int DisplayOrder = 0);
public record SyncPocket(string Id, string Name, string? Icon, string? Type, int DisplayOrder = 0, List<SyncCommitment>? Commitments = null);
public record SyncCommitment(string Title, decimal MonthlyAmount, decimal? TotalAmount, decimal PaidSoFar, int DueDay);
public record SyncTransaction(string Title, decimal Amount, string Type, string? Category, string? ExpenseClass, string? AccountId, string? PocketId, string? Date);
public record SyncDebt(string CreditorName, string? CreditorPhone, decimal OriginalAmount, decimal PaidSoFar, decimal MonthlyPayment, string? Notes);
public record SyncDue(string Title, decimal Amount, string Type, string Frequency, int DueDay, int? DueMonth, string? AccountId, string? PocketId, string? Category, bool IsActive);
public record SyncGoal(string Title, string? Description, decimal TargetAmount, decimal SavedSoFar, string? Deadline, List<GoalItemReq>? Items);
public record SyncZakat(string? HawalDate, decimal GoldGrams, List<SyncGoldPurchase>? GoldPurchases);
public record SyncGoldPurchase(decimal Grams, decimal PricePerGram, decimal TotalCost, string? Date, string? Notes);
public record SyncSettings(int DebtPercent, int SavingsPercent, string[]? ExpenseCategories, string[]? IncomeCategories);
