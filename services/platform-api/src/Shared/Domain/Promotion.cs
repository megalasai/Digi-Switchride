namespace PlatformApi.Shared.Domain;

public class Promotion
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public DateTime ValidFrom { get; set; }
    public DateTime ValidTo { get; set; }
    public int? MaxUses { get; set; }
    public int CurrentUses { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum DiscountType
{
    Percentage,
    FixedAmount
}

public class IoTDevice
{
    public Guid Id { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public Guid? VehicleId { get; set; }
    public string VendorType { get; set; } = string.Empty;
    public IoTConnectionStatus ConnectionStatus { get; set; } = IoTConnectionStatus.Unknown;
    public DateTime? LastSeenAt { get; set; }
    public int? BatteryPercent { get; set; }
    public double? LastLat { get; set; }
    public double? LastLng { get; set; }

    public Vehicle? Vehicle { get; set; }
}

public enum IoTConnectionStatus
{
    Connected,
    Disconnected,
    Unknown
}

public class AuditLog
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? BeforeState { get; set; }
    public string? AfterState { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class OtpRecord
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string OtpHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Customer Customer { get; set; } = null!;
}
