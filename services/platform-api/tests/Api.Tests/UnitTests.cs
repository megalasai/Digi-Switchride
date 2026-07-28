using PlatformApi.Shared;

namespace PlatformApi.Tests;

public class PricingEngineTests
{
    [Fact]
    public void EstimateFare_PerMinute_ReturnsBaseRate()
    {
        var fare = PricingEngine.EstimateFare("PerMinute", 10);
        Assert.Equal(15.0m, fare);
    }

    [Fact]
    public void EstimateFare_Weekly_ReturnsFixedRate()
    {
        var fare = PricingEngine.EstimateFare("Weekly");
        Assert.Equal(1050m, fare);
    }

    [Fact]
    public void CalculateGst_AppliesFivePercent()
    {
        var gst = PricingEngine.CalculateGst(100m);
        Assert.Equal(5.0m, gst);
    }

    [Fact]
    public void HaversineDistance_SamePoint_ReturnsZero()
    {
        var dist = GeoHelper.HaversineDistanceKm(21.1458, 79.0882, 21.1458, 79.0882);
        Assert.Equal(0, dist, precision: 2);
    }
}

public class CryptoHelperTests
{
    [Fact]
    public void MaskAadhaar_MasksCorrectly()
    {
        var masked = CryptoHelper.MaskAadhaar("123456789012");
        Assert.Equal("XXXX-XXXX-9012", masked);
    }

    [Fact]
    public void HashOtp_ProducesConsistentHash()
    {
        var hash1 = CryptoHelper.HashOtp("123456");
        var hash2 = CryptoHelper.HashOtp("123456");
        Assert.Equal(hash1, hash2);
    }
}
