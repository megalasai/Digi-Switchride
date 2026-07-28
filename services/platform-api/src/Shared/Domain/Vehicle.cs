namespace PlatformApi.Shared.Domain;

public class Vehicle
{
    public Guid Id { get; set; }
    public string RegistrationNumber { get; set; } = string.Empty;
    public VehicleType Type { get; set; }
    public string Model { get; set; } = string.Empty;
    public Guid HubId { get; set; }
    public VehicleStatus Status { get; set; } = VehicleStatus.Available;
    public int BatteryPercent { get; set; }
    public double OdometerKm { get; set; }
    public string? IoTDeviceId { get; set; }
    public string? PricingTier { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public RentalHub Hub { get; set; } = null!;
    public ICollection<Booking> Bookings { get; set; } = [];
}

public enum VehicleType
{
    EScooter,
    EBike,
    ERickshaw
}

public enum VehicleStatus
{
    Available,
    Reserved,
    InRide,
    Maintenance,
    Offline
}
