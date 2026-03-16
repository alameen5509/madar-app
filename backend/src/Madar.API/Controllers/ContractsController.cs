using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
public class ContractsController : BaseController
{
    private readonly MadarDbContext _db;
    public ContractsController(MadarDbContext db) => _db = db;

    // ── GET /api/contracts?status=Active ─────────────────────────────────────
    /// <summary>قائمة العقود مع فلتر status اختياري</summary>
    [HttpGet]
    public async Task<IActionResult> GetContracts(
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var query = _db.Contracts
            .Where(c => c.OwnerId == userId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<ContractStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        return Ok(contracts.Select(ToDto));
    }

    // ── GET /api/contracts/active ─────────────────────────────────────────────
    /// <summary>العقود النشطة أو قيد التجديد — للساعة الذكية</summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveContracts(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contracts = await _db.Contracts
            .Where(c => c.OwnerId == userId &&
                       (c.Status == ContractStatus.Active ||
                        c.Status == ContractStatus.PendingRenewal))
            .OrderBy(c => c.EndDate)
            .ToListAsync(ct);

        return Ok(contracts.Select(ToDto));
    }

    // ── GET /api/contracts/{id} ───────────────────────────────────────────────
    /// <summary>عقد واحد بالمعرّف</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetContract(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contract = await _db.Contracts
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (contract is null)
            return NotFound(new { error = "العقد غير موجود" });

        return Ok(ToDto(contract));
    }

    // ── POST /api/contracts ───────────────────────────────────────────────────
    /// <summary>إنشاء عقد جديد</summary>
    [HttpPost]
    public async Task<IActionResult> CreateContract(
        [FromBody] CreateContractRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = "عنوان العقد مطلوب" });

        if (string.IsNullOrWhiteSpace(req.ClientName))
            return BadRequest(new { error = "اسم العميل مطلوب" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contract = new Contract
        {
            Id          = Guid.NewGuid(),
            OwnerId     = userId,
            Title       = req.Title.Trim(),
            ClientName  = req.ClientName.Trim(),
            Description = req.Description?.Trim(),
            Notes       = req.Notes?.Trim(),
            Status      = Enum.TryParse<ContractStatus>(req.Status, ignoreCase: true, out var s)
                          ? s : ContractStatus.Draft,
            Value       = req.Value,
            Currency    = string.IsNullOrWhiteSpace(req.Currency) ? "SAR" : req.Currency.Trim().ToUpper(),
            StartDate   = req.StartDate,
            EndDate     = req.EndDate,
            RenewalReminderDays = req.RenewalReminderDays ?? 30,
            CreatedAt   = DateTime.UtcNow,
        };

        _db.Contracts.Add(contract);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetContract), new { id = contract.Id }, ToDto(contract));
    }

    // ── PATCH /api/contracts/{id}/status ─────────────────────────────────────
    /// <summary>تحديث حالة العقد</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateContractStatusRequest req,
        CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contract = await _db.Contracts
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (contract is null)
            return NotFound(new { error = "العقد غير موجود" });

        if (!Enum.TryParse<ContractStatus>(req.Status, ignoreCase: true, out var newStatus))
            return BadRequest(new { error = "حالة غير صالحة. القيم المقبولة: Draft, Active, PendingRenewal, Expired, Cancelled" });

        contract.Status    = newStatus;
        contract.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ToDto(contract));
    }

    // ── PUT /api/contracts/{id} ───────────────────────────────────────────────
    /// <summary>تعديل بيانات العقد كاملاً</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateContract(
        Guid id,
        [FromBody] CreateContractRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = "عنوان العقد مطلوب" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contract = await _db.Contracts
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (contract is null)
            return NotFound(new { error = "العقد غير موجود" });

        contract.Title               = req.Title.Trim();
        contract.ClientName          = req.ClientName?.Trim() ?? contract.ClientName;
        contract.Description         = req.Description?.Trim();
        contract.Notes               = req.Notes?.Trim();
        contract.Status              = Enum.TryParse<ContractStatus>(req.Status, ignoreCase: true, out var s)
                                       ? s : contract.Status;
        contract.Value               = req.Value ?? contract.Value;
        contract.Currency            = string.IsNullOrWhiteSpace(req.Currency)
                                       ? contract.Currency : req.Currency.Trim().ToUpper();
        contract.StartDate           = req.StartDate ?? contract.StartDate;
        contract.EndDate             = req.EndDate ?? contract.EndDate;
        contract.RenewalReminderDays = req.RenewalReminderDays ?? contract.RenewalReminderDays;
        contract.UpdatedAt           = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(ToDto(contract));
    }

    // ── DELETE /api/contracts/{id} ────────────────────────────────────────────
    /// <summary>حذف عقد</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteContract(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var contract = await _db.Contracts
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

        if (contract is null)
            return NotFound(new { error = "العقد غير موجود" });

        _db.Contracts.Remove(contract);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── Helper ────────────────────────────────────────────────────────────────
    private static object ToDto(Contract c) => new
    {
        id                  = c.Id,
        title               = c.Title,
        clientName          = c.ClientName,
        description         = c.Description,
        notes               = c.Notes,
        status              = c.Status.ToString(),
        value               = c.Value,
        currency            = c.Currency,
        startDate           = c.StartDate,
        endDate             = c.EndDate,
        renewalReminderDays = c.RenewalReminderDays,
        createdAt           = c.CreatedAt,
        updatedAt           = c.UpdatedAt,
        isNearRenewal       = c.EndDate.HasValue &&
                              c.Status == ContractStatus.Active &&
                              c.EndDate.Value <= DateTime.UtcNow.AddDays(c.RenewalReminderDays),
    };
}

// ── Request records ───────────────────────────────────────────────────────────

public record CreateContractRequest(
    string    Title,
    string    ClientName,
    string?   Description,
    string?   Notes,
    string?   Status,
    decimal?  Value,
    string?   Currency,
    DateTime? StartDate,
    DateTime? EndDate,
    int?      RenewalReminderDays
);

public record UpdateContractStatusRequest(string Status);
