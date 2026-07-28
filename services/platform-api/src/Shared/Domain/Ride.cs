using NetTopologySuite.Geometries;

namespace PlatformApi.Shared.Domain;

public class Ride
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid CustomerId { get; set; }
    public RideStatus Status { get; set; } = RideStatus.NotStarted;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public Point? StartLocation { get; set; }
    public Point? EndLocation { get; set; }
    public int? DurationMinutes { get; set; }
    public double? DistanceKm { get; set; }
    public decimal? FinalFare { get; set; }
    public string? StartIdempotencyKey { get; set; }
    public string? EndIdempotencyKey { get; set; }

    public Booking Booking { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public ICollection<TelemetryPoint> TelemetryPoints { get; set; } = [];
}

public enum RideStatus
{
    NotStarted,
    InProgress,
    Ended,
    ForceEnded
}

public class TelemetryPoint
{
    public long Id { get; set; }
    public Guid RideId { get; set; }
    public Point Location { get; set; } = null!;
    public int BatteryPercent { get; set; }
    public double OdometerKm { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    public Ride Ride { get; set; } = null!;
}
