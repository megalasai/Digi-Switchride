namespace PlatformApi.Shared.Domain;

public class Payment
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid BookingId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public PaymentStatus Status { get; set; } = PaymentStatus.Created;
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public string? Method { get; set; }
    public decimal GstAmount { get; set; }
    public string? InvoiceUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? ReconciledAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public Booking Booking { get; set; } = null!;
}

public enum PaymentStatus
{
    Created,
    Paid,
    Failed,
    Refunded
}
