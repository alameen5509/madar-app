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
            .Select(p => new { p.Prayer, p.PrayedOnTime, p.PrayedInMosque })
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
            .Select(p => new { p.Date, p.Prayer, p.PrayedOnTime, p.PrayedInMosque })
            .ToListAsync(ct);
        return Ok(logs);
    }

    // ─── POST toggle on-time or in-mosque ───
    [HttpPost("toggle")]
    public async Task<IActionResult> Toggle([FromBody] TogglePrayerRequest req, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var log = await _db.PrayerLogs
            .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == today && p.Prayer == req.Prayer, ct);

        if (log == null)
        {
            log = new PrayerLog
            {
                Id = Guid.NewGuid(),
                OwnerId = UserId,
                Date = today,
                Prayer = req.Prayer,
            };
            _db.PrayerLogs.Add(log);
        }

        if (req.Field == "onTime")
            log.PrayedOnTime = req.Value;
        else if (req.Field == "inMosque")
            log.PrayedInMosque = req.Value;

        // If toggled OFF → create penalty if not exists
        if (!req.Value)
        {
            var reason = req.Field == "onTime" ? "not_on_time" : "not_in_mosque";
            var penaltyExists = await _db.PrayerPenalties.AnyAsync(p =>
                p.OwnerId == UserId && p.Date == today && p.Prayer == req.Prayer && p.Reason == reason, ct);
            if (!penaltyExists)
            {
                var settings = await _db.PrayerSettings.FirstOrDefaultAsync(s => s.OwnerId == UserId, ct);
                var penaltyType = "quran";
                if (settings != null)
                {
                    try
                    {
                        var config = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(settings.PenaltyConfigJson);
                        var key = $"{req.Prayer}_{(req.Field == "onTime" ? "time" : "mosque")}";
                        if (config != null && config.TryGetValue(key, out var pt)) penaltyType = pt;
                    }
                    catch { }
                }
                _db.PrayerPenalties.Add(new PrayerPenalty
                {
                    Id = Guid.NewGuid(), OwnerId = UserId,
                    Date = today, Prayer = req.Prayer,
                    Reason = reason, PenaltyType = penaltyType,
                });
            }
        }

        // If toggled ON, mark matching penalty as fulfilled (don't delete)
        if (req.Value)
        {
            var reason = req.Field == "onTime" ? "not_on_time" : "not_in_mosque";
            var penalty = await _db.PrayerPenalties
                .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == today
                    && p.Prayer == req.Prayer && p.Reason == reason && !p.Fulfilled, ct);
            if (penalty != null)
            {
                penalty.Fulfilled = true;
                penalty.FulfilledAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { log.PrayedOnTime, log.PrayedInMosque });
    }

    // ─── POST mark prayer time as expired (adds penalties for unchecked fields) ───
    [HttpPost("expire")]
    public async Task<IActionResult> ExpirePrayer([FromBody] ExpirePrayerRequest req, CancellationToken ct)
    {
        var date = DateOnly.Parse(req.Date);
        var log = await _db.PrayerLogs
            .FirstOrDefaultAsync(p => p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer, ct);

        // Get penalty config
        var settings = await _db.PrayerSettings
            .FirstOrDefaultAsync(s => s.OwnerId == UserId, ct);
        Dictionary<string, string>? config = null;
        if (settings != null)
        {
            try { config = JsonSerializer.Deserialize<Dictionary<string, string>>(settings.PenaltyConfigJson); }
            catch { }
        }

        string GetPenaltyType(string prayer, string field)
        {
            var key = $"{prayer}_{field}";
            if (config != null && config.TryGetValue(key, out var pt)) return pt;
            return "quran"; // default
        }

        bool prayedOnTime = log?.PrayedOnTime ?? false;
        bool prayedInMosque = log?.PrayedInMosque ?? false;
        bool notLoggedAtAll = log == null;

        // Create log if doesn't exist
        if (log == null)
        {
            log = new PrayerLog
            {
                Id = Guid.NewGuid(), OwnerId = UserId,
                Date = date, Prayer = req.Prayer,
            };
            _db.PrayerLogs.Add(log);
        }

        // السنن والنوافل: عقوبة واحدة فقط على عدم الأداء (بدون وقت أو مسجد)
        var sunnahKeys = new HashSet<string> { "Duha", "Witr", "SunnahFajr", "Rawatib" };
        var isSunnah = sunnahKeys.Contains(req.Prayer);

        // Penalty 1: not prayed at all (only if prayer was never logged)
        if (notLoggedAtAll)
        {
            var exists = await _db.PrayerPenalties.AnyAsync(p =>
                p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer && p.Reason == "not_prayed", ct);
            if (!exists)
            {
                _db.PrayerPenalties.Add(new PrayerPenalty
                {
                    Id = Guid.NewGuid(), OwnerId = UserId,
                    Date = date, Prayer = req.Prayer,
                    Reason = "not_prayed",
                    PenaltyType = GetPenaltyType(req.Prayer, "time"),
                });
            }
        }

        // الفرائض فقط: عقوبات إضافية على الوقت والمسجد
        if (!isSunnah)
        {
            // Penalty 2: not on time
            if (!prayedOnTime)
            {
                var exists = await _db.PrayerPenalties.AnyAsync(p =>
                    p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer && p.Reason == "not_on_time", ct);
                if (!exists)
                {
                    _db.PrayerPenalties.Add(new PrayerPenalty
                    {
                        Id = Guid.NewGuid(), OwnerId = UserId,
                        Date = date, Prayer = req.Prayer,
                        Reason = "not_on_time",
                        PenaltyType = GetPenaltyType(req.Prayer, "time"),
                    });
                }
            }

            // Penalty 3: not in mosque
            if (!prayedInMosque)
            {
                var exists = await _db.PrayerPenalties.AnyAsync(p =>
                    p.OwnerId == UserId && p.Date == date && p.Prayer == req.Prayer && p.Reason == "not_in_mosque", ct);
                if (!exists)
                {
                    _db.PrayerPenalties.Add(new PrayerPenalty
                    {
                        Id = Guid.NewGuid(), OwnerId = UserId,
                        Date = date, Prayer = req.Prayer,
                        Reason = "not_in_mosque",
                        PenaltyType = GetPenaltyType(req.Prayer, "mosque"),
                    });
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ─── GET penalties (pending + optional completed) ───
    [HttpGet("penalties")]
    public async Task<IActionResult> GetPenalties([FromQuery] bool includeCompleted = false, CancellationToken ct = default)
    {
        var query = _db.PrayerPenalties.Where(p => p.OwnerId == UserId);
        if (!includeCompleted) query = query.Where(p => !p.Fulfilled);

        var penalties = await query
            .OrderByDescending(p => p.Date)
            .Select(p => new { p.Id, p.Date, p.Prayer, p.Reason, p.PenaltyType, p.PenaltyDetail, p.Fulfilled, p.FulfilledAt })
            .ToListAsync(ct);

        var pendingCount = await _db.PrayerPenalties.CountAsync(p => p.OwnerId == UserId && !p.Fulfilled, ct);
        var fulfilledCount = await _db.PrayerPenalties.CountAsync(p => p.OwnerId == UserId && p.Fulfilled, ct);

        return Ok(new { penalties, pendingCount, fulfilledCount });
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
            .Where(p => p.OwnerId == UserId && p.Date >= weekAgo && p.Date <= today)
            .ToListAsync(ct);

        var total = weekLogs.Count;
        var onTime = weekLogs.Count(l => l.PrayedOnTime);
        var inMosque = weekLogs.Count(l => l.PrayedInMosque);

        // Longest streak of full days (all 5 on time + in mosque)
        var allLogs = await _db.PrayerLogs
            .Where(p => p.OwnerId == UserId)
            .OrderBy(p => p.Date)
            .ToListAsync(ct);

        int longestStreak = 0, currentStreak = 0;
        DateOnly? lastDate = null;
        var groupedByDate = allLogs.GroupBy(l => l.Date).OrderBy(g => g.Key);
        foreach (var dayGroup in groupedByDate)
        {
            var dayPrayers = dayGroup.ToList();
            var allDone = dayPrayers.All(p => p.PrayedOnTime && p.PrayedInMosque)
                          && dayPrayers.Count >= 5;
            if (allDone)
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
            weekOnTimePercent = total == 0 ? 0 : Math.Round((double)onTime / total * 100),
            weekMosquePercent = total == 0 ? 0 : Math.Round((double)inMosque / total * 100),
            longestStreak,
            pendingPenalties,
        });
    }
}

public record TogglePrayerRequest(string Prayer, string Field, bool Value);
public record ExpirePrayerRequest(string Prayer, string Date);
public record UpdatePrayerSettingsRequest(Dictionary<string, string> PenaltyConfig, bool NotificationsEnabled);
