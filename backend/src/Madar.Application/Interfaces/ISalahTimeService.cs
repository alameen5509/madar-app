using Madar.Domain.Enums;

namespace Madar.Application.Interfaces;

public interface ISalahTimeService
{
    Task<SalahTimes> GetTimesAsync(string latitude, string longitude, DateOnly date, CalculationMethod method, CancellationToken ct = default);
}

public record SalahTimes(
    DateOnly Date,
    TimeOnly Fajr,
    TimeOnly Shuruq,
    TimeOnly Dhuhr,
    TimeOnly Asr,
    TimeOnly Maghrib,
    TimeOnly Isha
)
{
    public TimeOnly GetBlockStart(SalahBlock block) => block switch
    {
        SalahBlock.PreFajr     => Fajr.AddMinutes(-90),
        SalahBlock.PostFajr    => Fajr.AddMinutes(15),
        SalahBlock.Duha        => Shuruq.AddMinutes(30),
        SalahBlock.PostDhuhr   => Dhuhr.AddMinutes(15),
        SalahBlock.PostAsr     => Asr.AddMinutes(15),
        SalahBlock.PostMaghrib => Maghrib.AddMinutes(15),
        SalahBlock.PostIsha    => Isha.AddMinutes(15),
        _                      => new TimeOnly(23, 0)
    };
}
