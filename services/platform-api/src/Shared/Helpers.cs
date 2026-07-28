using System.Security.Cryptography;
using System.Text;

namespace PlatformApi.Shared;

public static class CryptoHelper
{
    public static string HashOtp(string otp)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(otp));
        return Convert.ToBase64String(bytes);
    }

    public static string GenerateOtp()
    {
        return Random.Shared.Next(100000, 999999).ToString();
    }

    public static string MaskAadhaar(string aadhaar)
    {
        if (aadhaar.Length < 4) return "****";
        return $"XXXX-XXXX-{aadhaar[^4..]}";
    }
}

public static class PricingEngine
{
    private static readonly Dictionary<string, decimal> BaseRates = new()
    {
        ["PerMinute"] = 1.50m,
        ["Hourly"] = 60m,
        ["Daily"] = 400m,
        ["Weekly"] = 1050m,
        ["Monthly"] = 4000m
    };

    public static decimal EstimateFare(string bookingType, int? durationMinutes = null)
    {
        if (BaseRates.TryGetValue(bookingType, out var rate))
        {
            if (bookingType == "PerMinute" && durationMinutes.HasValue)
                return rate * durationMinutes.Value;
            return rate;
        }
        return 0;
    }

    public static decimal CalculateRideFare(int durationMinutes, double distanceKm, string bookingType)
    {
        if (bookingType != "PerMinute")
            return EstimateFare(bookingType);

        var timeFare = 1.50m * durationMinutes;
        var distanceFare = 0m; // distance-based pricing optional
        return Math.Round(timeFare + distanceFare, 2);
    }

    public static decimal CalculateGst(decimal amount, decimal gstRate = 0.05m)
    {
        return Math.Round(amount * gstRate, 2);
    }
}

public static class GeoHelper
{
    public static double HaversineDistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371;
        var dLat = ToRad(lat2 - lat1);
        var dLng = ToRad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180;
}
