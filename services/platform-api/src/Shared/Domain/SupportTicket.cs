namespace PlatformApi.Shared.Domain;

public class SupportTicket
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public TicketCategory Category { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? BookingId { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.Open;
    public Guid? AssignedTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public Customer Customer { get; set; } = null!;
}

public enum TicketCategory
{
    Ride,
    Payment,
    KYC,
    Vehicle,
    General
}

public enum TicketStatus
{
    Open,
    InProgress,
    Resolved,
    Closed
}
