using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/contacts")]
public class ContactsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public ContactsController(MadarDbContext db) => _db = db;

    /// <summary>قائمة جهات الاتصال</summary>
    [HttpGet]
    public async Task<IActionResult> GetContacts(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var contacts = await _db.Contacts
            .Where(c => c.OwnerId == userId)
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id, c.Name, c.Phone, c.Notes, c.CreatedAt,
                taskCount = c.LinkedTasks.Count,
            })
            .ToListAsync(ct);

        return Ok(contacts);
    }

    /// <summary>إنشاء جهة اتصال</summary>
    [HttpPost]
    public async Task<IActionResult> CreateContact([FromBody] CreateContactRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var phone = NormalizePhone(req.Phone);

        // Check duplicate
        var exists = await _db.Contacts.AnyAsync(c => c.OwnerId == userId && c.Phone == phone, ct);
        if (exists)
            return BadRequest(new { error = "جهة الاتصال موجودة بالفعل" });

        var contact = new Contact
        {
            Id = Guid.NewGuid(),
            OwnerId = userId,
            Name = req.Name.Trim(),
            Phone = phone,
            Notes = req.Notes?.Trim(),
        };
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(ct);

        return Ok(new { contact.Id, contact.Name, contact.Phone, contact.Notes, taskCount = 0 });
    }

    /// <summary>استيراد جماعي (من جهات اتصال الجوال)</summary>
    [HttpPost("import")]
    public async Task<IActionResult> ImportContacts([FromBody] ImportContactsRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var existing = await _db.Contacts
            .Where(c => c.OwnerId == userId)
            .Select(c => c.Phone)
            .ToHashSetAsync(ct);

        var added = 0;
        foreach (var item in req.Contacts)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Phone)) continue;
            var phone = NormalizePhone(item.Phone);
            if (existing.Contains(phone)) continue;

            _db.Contacts.Add(new Contact
            {
                Id = Guid.NewGuid(),
                OwnerId = userId,
                Name = item.Name.Trim(),
                Phone = phone,
            });
            existing.Add(phone);
            added++;
        }

        if (added > 0) await _db.SaveChangesAsync(ct);
        return Ok(new { added, message = $"تم استيراد {added} جهة اتصال" });
    }

    /// <summary>تعديل جهة اتصال</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateContact(Guid id, [FromBody] UpdateContactRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var contact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);
        if (contact is null) return NotFound();

        if (req.Name is not null) contact.Name = req.Name.Trim();
        if (req.Phone is not null) contact.Phone = NormalizePhone(req.Phone);
        if (req.Notes is not null) contact.Notes = req.Notes.Trim();

        await _db.SaveChangesAsync(ct);
        return Ok(new { contact.Id, contact.Name, contact.Phone, contact.Notes });
    }

    /// <summary>حذف جهة اتصال</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteContact(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var contact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);
        if (contact is null) return NotFound();

        _db.Contacts.Remove(contact);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم حذف جهة الاتصال" });
    }

    /// <summary>مهام مرتبطة بجهة اتصال</summary>
    [HttpGet("{id:guid}/tasks")]
    public async Task<IActionResult> GetContactTasks(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var tasks = await _db.SmartTasks
            .Where(t => t.ContactId == id && t.OwnerId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Title, status = t.Status.ToString(), t.DueDate, t.CompletedAt,
            })
            .ToListAsync(ct);

        return Ok(tasks);
    }

    private static string NormalizePhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        // Saudi: 05xx → 9665xx
        if (digits.StartsWith("05") && digits.Length == 10)
            digits = "966" + digits[1..];
        // Remove leading 00
        if (digits.StartsWith("00"))
            digits = digits[2..];
        return digits;
    }
}

public record CreateContactRequest(string Name, string Phone, string? Notes = null);
public record UpdateContactRequest(string? Name = null, string? Phone = null, string? Notes = null);
public record ImportContactsRequest(List<ImportContactItem> Contacts);
public record ImportContactItem(string Name, string Phone);
