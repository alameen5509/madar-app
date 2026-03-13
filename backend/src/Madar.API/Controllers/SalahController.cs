using Madar.Application.Interfaces;
using Madar.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Madar.API.Controllers;

public class SalahController : BaseController
{
    private readonly ISalahTimeService _salah;
    private readonly IMemoryCache _cache;

    public SalahController(ISalahTimeService salah, IMemoryCache cache)
    {
        _salah = salah;
        _cache = cache;
    }

    [HttpGet("today")]
    public async Task<IActionResult> Today(
        [FromQuery] string lat,
        [FromQuery] string lng,
        CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cacheKey = $"salah:today:{lat}:{lng}:{today}";

        if (!_cache.TryGetValue(cacheKey, out SalahTimes? times))
        {
            times = await _salah.GetTimesAsync(lat, lng, today, CalculationMethod.UmmAlQura, ct);
            _cache.Set(cacheKey, times, TimeSpan.FromHours(12));
        }

        return Ok(new
        {
            date    = times!.Date,
            fajr    = times.Fajr.ToString("HH:mm"),
            shuruq  = times.Shuruq.ToString("HH:mm"),
            dhuhr   = times.Dhuhr.ToString("HH:mm"),
            asr     = times.Asr.ToString("HH:mm"),
            maghrib = times.Maghrib.ToString("HH:mm"),
            isha    = times.Isha.ToString("HH:mm"),
        });
    }

    [HttpGet("blocks")]
    public async Task<IActionResult> Blocks(
        [FromQuery] string lat,
        [FromQuery] string lng,
        CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cacheKey = $"salah:blocks:{lat}:{lng}:{today}";

        if (!_cache.TryGetValue(cacheKey, out object? result))
        {
            var times = await _salah.GetTimesAsync(lat, lng, today, CalculationMethod.UmmAlQura, ct);

            result = Enum.GetValues<SalahBlock>()
                .Where(b => b != SalahBlock.Overnight)
                .Select(b =>
                {
                    var start = times.GetBlockStart(b);
                    var next  = GetNextBlockStart(b, times);
                    return new
                    {
                        block = b.ToString(),
                        start = start.ToString("HH:mm"),
                        end   = next?.ToString("HH:mm"),
                    };
                })
                .ToList();

            _cache.Set(cacheKey, result, TimeSpan.FromHours(12));
        }

        return Ok(result);
    }

    private static TimeOnly? GetNextBlockStart(SalahBlock block, SalahTimes t)
    {
        var ordered = new[]
        {
            (SalahBlock.PreFajr,     t.GetBlockStart(SalahBlock.PostFajr)),
            (SalahBlock.PostFajr,    t.GetBlockStart(SalahBlock.Duha)),
            (SalahBlock.Duha,        t.GetBlockStart(SalahBlock.PostDhuhr)),
            (SalahBlock.PostDhuhr,   t.GetBlockStart(SalahBlock.PostAsr)),
            (SalahBlock.PostAsr,     t.GetBlockStart(SalahBlock.PostMaghrib)),
            (SalahBlock.PostMaghrib, t.GetBlockStart(SalahBlock.PostIsha)),
            (SalahBlock.PostIsha,    (TimeOnly?)null),
        };

        return ordered.FirstOrDefault(x => x.Item1 == block).Item2;
    }
}
