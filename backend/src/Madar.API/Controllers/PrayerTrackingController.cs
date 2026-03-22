using System.Security.Claims;
using System.Text.Json;
using Madar.Domain.Entities.Core;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize]
[Route("api/prayer-tracking")]
public class PrayerTrackingController : BaseController
{
    private readonly MadarDbContext _db;
    public PrayerTrackingController(MadarDbContext db) => _db = db;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ─── GET today's prayer logs ───
    [HttpGet("today")]
    public async Task<IActionResult> GetToday(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var logs = await _db.PrayerLogs
            .Where(p => p.OwnerId == UserId && p.Date == today)
            .Select(p => new { p.Prayer, p.Status })
            .ToListAsync(ct);
        return Ok(logs);
    }

    // ─── GET logs for a date range (for stats) ───
    [HttpGet("range")]
    public async Task<IActionResult> GetRange(
        [FromQuery] string from, [FromQuery] string to, CancellationToken ct)
    {
        var fromDate = DateOnly.Parse(from);
        var toDate = DateOnly.Parse(to);
        var logs = await _db.PrayerLogs
            .Where(p => p.OwnerId == UserId && p.Date >= fromDate && p.Date <= toDate)
            .Select(p => new { p.Date, p.Prayer, p.Status })
            .ToListAsync(ct);
        return Ok(logs);
    }

    // ─── POST mark prayer ───
    [HttpPost("mark")]
    public async Task<IActionResult> MarkPrayer([FromBody] MarkPrayerRequest req, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var existing = await _db.PrayerLogs
            .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == today && p.Prayer == req.Prayer, ct);

        if (existing != null)
        {
            existing.Status = req.Status;
        }
        else
        {
            _db.PrayerLogs.Add(new PrayerLog
            {
                Id = Guid.NewGuid(),
                OwnerId = UserId,
                Date = today,
                Prayer = req.Prayer,
                Status = req.Status,
            });
        }

        // If marked (not missed), remove any pending penalty for today
        if (req.Status != "Missed")
        {
            var penalty = await _db.PrayerPenalties
                .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == today && p.Prayer == req.Prayer && !p.Fulfilled, ct);
            if (penalty != null)
                _db.PrayerPenalties.Remove(penalty);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ─── POST mark prayer as missed (adds penalty) ───
    [HttpPost("miss")]
    public async Task<IActionResult> MissPrayer([FromBody] MissPrayerRequest req, CancellationToken ct)
    {
        var date = DateOnly.Parse(req.Date);
        var existing = await _db.PrayerLogs
            .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer, ct);

        if (existing != null)
            existing.Status = "Missed";
        else
        {
            _db.PrayerLogs.Add(new PrayerLog
            {
                Id = Guid.NewGuid(),
                OwnerId = UserId,
                Date = date,
                Prayer = req.Prayer,
                Status = "Missed",
            });
        }

        // Add penalty if not already exists
        var hasPenalty = await _db.PrayerPenalties
            .AnyAsync(p => p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer, ct);
        if (!hasPenalty)
        {
            // Get penalty config
            var settings = await _db.PrayerSettings
                .FirstOrDefaultAsync(s => s.OwnerId == UserId, ct);
            var penaltyType = "surah";
            if (settings != null)
            {
                try
                {
                    var config = JsonSerializer.Deserialize<Dictionary<string, string>>(settings.PenaltyConfigJson);
                    if (config != null && config.TryGetValue(req.Prayer, out var pt))
                        penaltyType = pt;
                }
                catch { }
            }

            _db.PrayerPenalties.Add(new PrayerPenalty
            {
                Id = Guid.NewGuid(),
                OwnerId = UserId,
                Date = date,
                Prayer = req.Prayer,
                PenaltyType = penaltyType,
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ─── GET pending penalties ───
    [HttpGet("penalties")]
    public async Task<IActionResult> GetPenalties(CancellationToken ct)
    {
        var penalties = await _db.PrayerPenalties
            .Where(p => p.OwnerId == UserId && !p.Fulfilled)
            .OrderByDescending(p => p.Date)
            .Select(p => new { p.Id, p.Date, p.Prayer, p.PenaltyType, p.PenaltyDetail })
            .ToListAsync(ct);
        return Ok(penalties);
    }

    // ─── POST fulfill penalty ───
    [HttpPost("penalties/{id:guid}/fulfill")]
    public async Task<IActionResult> FulfillPenalty(Guid id, CancellationToken ct)
    {
        var penalty = await _db.PrayerPenalties
            .FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == UserId, ct);
        if (penalty is null) return NotFound();
        penalty.Fulfilled = true;
        penalty.FulfilledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ─── GET/PUT settings ───
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var settings = await _db.PrayerSettings
            .FirstOrDefaultAsync(s => s.OwnerId == UserId, ct);
        if (settings == null)
            return Ok(new { penaltyConfig = new Dictionary<string, string>(), notificationsEnabled = true });
        return Ok(new
        {
            penaltyConfig = JsonSerializer.Deserialize<Dictionary<string, string>>(settings.PenaltyConfigJson),
            notificationsEnabled = settings.NotificationsEnabled,
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdatePrayerSettingsRequest req, CancellationToken ct)
    {
        var settings = await _db.PrayerSettings
            .FirstOrDefaultAsync(s => s.OwnerId == UserId, ct);
        if (settings == null)
        {
            settings = new PrayerSettings { Id = Guid.NewGuid(), OwnerId = UserId };
            _db.PrayerSettings.Add(settings);
        }
        settings.PenaltyConfigJson = JsonSerializer.Serialize(req.PenaltyConfig);
        settings.NotificationsEnabled = req.NotificationsEnabled;
        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ─── GET stats ───
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekAgo = today.AddDays(-6);

        var weekLogs = await _db.PrayerLogs
            .Where(p => p.OwnerId == UserId && p.Date >= weekAgo && p.Date <= today
                        && p.Prayer != "Duha") // Duha is optional
            .ToListAsync(ct);

        var totalPrayers = weekLogs.Count;
        var onTime = weekLogs.Count(l => l.Status == "OnTime" || l.Status == "InMosque");
        var inMosque = weekLogs.Count(l => l.Status == "InMosque");
        var missed = weekLogs.Count(l => l.Status == "Missed");

        // Longest streak of on-time days
        var allLogs = await _db.PrayerLogs
            .Where(p => p.OwnerId == UserId && p.Prayer != "Duha")
            .OrderBy(p => p.Date)
            .ToListAsync(ct);

        int longestStreak = 0, currentStreak = 0;
        DateOnly? lastDate = null;
        var groupedByDate = allLogs.GroupBy(l => l.Date).OrderBy(g => g.Key);
        foreach (var dayGroup in groupedByDate)
        {
            var dayPrayers = dayGroup.ToList();
            var allOnTime = dayPrayers.All(p => p.Status == "OnTime" || p.Status == "InMosque")
                            && dayPrayers.Count >= 5;
            if (allOnTime)
            {
                if (lastDate == null || dayGroup.Key == lastDate.Value.AddDays(1))
                    currentStreak++;
                else
                    currentStreak = 1;
                longestStreak = Math.Max(longestStreak, currentStreak);
            }
            else
            {
                currentStreak = 0;
            }
            lastDate = dayGroup.Key;
        }

        var pendingPenalties = await _db.PrayerPenalties
            .CountAsync(p => p.OwnerId == UserId && !p.Fulfilled, ct);

        return Ok(new
        {
            weekOnTimePercent = totalPrayers == 0 ? 0 : Math.Round((double)onTime / totalPrayers * 100),
            weekMosquePercent = totalPrayers == 0 ? 0 : Math.Round((double)inMosque / totalPrayers * 100),
            longestStreak,
            pendingPenalties,
        });
    }
}

public record MarkPrayerRequest(string Prayer, string Status);
public record MissPrayerRequest(string Prayer, string Date);
public record UpdatePrayerSettingsRequest(Dictionary<string, string> PenaltyConfig, bool NotificationsEnabled);
