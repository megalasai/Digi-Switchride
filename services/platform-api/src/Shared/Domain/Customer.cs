namespace PlatformApi.Shared.Domain;

public class Customer
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? EmergencyContact { get; set; }
    public KycStatusEnum KycStatus { get; set; } = KycStatusEnum.NotSubmitted;
    public AccountStatus AccountStatus { get; set; } = AccountStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<KycSubmission> KycSubmissions { get; set; } = [];
    public ICollection<Booking> Bookings { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
}

public enum KycStatusEnum
{
    NotSubmitted,
    Pending,
    UnderReview,
    Approved,
    Rejected
}

public enum AccountStatus
{
    Active,
    Suspended,
    Deactivated
}
