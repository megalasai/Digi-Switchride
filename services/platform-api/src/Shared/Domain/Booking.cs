namespace PlatformApi.Shared.Domain;

public class Booking
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid HubId { get; set; }
    public BookingType BookingType { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Draft;
    public decimal EstimatedAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? PromoCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    public Customer Customer { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
    public RentalHub Hub { get; set; } = null!;
    public Ride? Ride { get; set; }
    public ICollection<Payment> Payments { get; set; } = [];
}

public enum BookingType
{
    PerMinute,
    Hourly,
    Daily,
    Weekly,
    Monthly
}

public enum BookingStatus
{
    Draft,
    Confirmed,
    Active,
    Completed,
    Cancelled,
    NoShow
}
