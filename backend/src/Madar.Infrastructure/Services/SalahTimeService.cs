using System.Net.Http.Json;
using System.Text.Json;
using Madar.Application.Interfaces;
using Madar.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Madar.Infrastructure.Services;

public class SalahTimeService : ISalahTimeService
{
    private readonly HttpClient _http;
    private readonly ILogger<SalahTimeService> _logger;

    public SalahTimeService(HttpClient http, ILogger<SalahTimeService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<SalahTimes> GetTimesAsync(string latitude, string longitude, DateOnly date, CalculationMethod method, CancellationToken ct = default)
    {
        var methodId = method switch
        {
            CalculationMethod.UmmAlQura => 4,
            CalculationMethod.Egyptian  => 5,
            CalculationMethod.Karachi   => 1,
            _                           => 4
        };

        var url = $"https://api.aladhan.com/v1/timings/{date:dd-MM-yyyy}?latitude={latitude}&longitude={longitude}&method={methodId}";

        try
        {
            var response = await _http.GetFromJsonAsync<JsonElement>(url, ct);
            var timings = response.GetProperty("data").GetProperty("timings");

            return new SalahTimes(
                date,
                ParseTime(timings.GetProperty("Fajr").GetString()!),
                ParseTime(timings.GetProperty("Sunrise").GetString()!),
                ParseTime(timings.GetProperty("Dhuhr").GetString()!),
                ParseTime(timings.GetProperty("Asr").GetString()!),
                ParseTime(timings.GetProperty("Maghrib").GetString()!),
                ParseTime(timings.GetProperty("Isha").GetString()!)
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Salah times. Using defaults.");
            return FallbackTimes(date);
        }
    }

    private static TimeOnly ParseTime(string t) => TimeOnly.ParseExact(t[..5], "HH:mm");

    private static SalahTimes FallbackTimes(DateOnly date) => new(
        date,
        new TimeOnly(5, 0), new TimeOnly(6, 15), new TimeOnly(12, 0),
        new TimeOnly(15, 30), new TimeOnly(18, 0), new TimeOnly(19, 30)
    );
}
