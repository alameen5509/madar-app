using System.Globalization;

namespace Madar.API.Helpers;

public static class DateConverter
{
    private static readonly HijriCalendar _hijri = new();

    private static readonly string[] HijriMonths = {
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    };

    private static readonly string[] GregorianMonths = {
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    };

    /// <summary>Convert Hijri date to Gregorian DateTime</summary>
    public static DateTime? HijriToGregorian(int year, int month, int day)
    {
        try
        {
            return _hijri.ToDateTime(year, month, day, 0, 0, 0, 0);
        }
        catch
        {
            // Approximate if date is out of HijriCalendar range
            try
            {
                var approxYear = (int)((year - 1) * 354.37 / 365.25 + 622);
                return new DateTime(approxYear, Math.Clamp(month, 1, 12), Math.Clamp(day, 1, 28));
            }
            catch { return null; }
        }
    }

    /// <summary>Convert Gregorian date to Hijri (year, month, day)</summary>
    public static (int year, int month, int day) GregorianToHijri(DateTime date)
    {
        return (_hijri.GetYear(date), _hijri.GetMonth(date), _hijri.GetDayOfMonth(date));
    }

    /// <summary>Format Hijri date as Arabic text: "4 شعبان 1332 هـ"</summary>
    public static string FormatHijri(int year, int month, int day)
    {
        var monthName = month >= 1 && month <= 12 ? HijriMonths[month - 1] : $"{month}";
        return $"{day} {monthName} {year} هـ";
    }

    /// <summary>Format Gregorian date as Arabic text: "28 يونيو 1914 م"</summary>
    public static string FormatGregorian(DateTime date)
    {
        var monthName = GregorianMonths[date.Month - 1];
        return $"{date.Day} {monthName} {date.Year} م";
    }

    /// <summary>Parse a Hijri text like "4 شعبان 1332 هـ" into components</summary>
    public static (int? year, int? month, int? day) ParseHijriText(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return (null, null, null);
        // Remove هـ suffix and trim
        text = text.Replace("هـ", "").Trim();
        var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 3) return (null, null, null);

        int.TryParse(parts[0], out var day);
        var monthIdx = Array.FindIndex(HijriMonths, m => parts[1].Contains(m) || m.Contains(parts[1]));
        int.TryParse(parts[^1], out var year);

        return (year > 0 ? year : null, monthIdx >= 0 ? monthIdx + 1 : null, day > 0 ? day : null);
    }
}
