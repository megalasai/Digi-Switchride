using Microsoft.EntityFrameworkCore;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.Payments;

public interface IPaymentService
{
    Task<PaymentOrderDto> CreateOrderAsync(Guid customerId, CreatePaymentOrderRequest request);
    Task HandleRazorpayWebhookAsync(string payload, string signature);
    Task<PagedResult<PaymentRecordDto>> GetHistoryAsync(Guid customerId, int page, int pageSize);
    Task<FinanceReconciliationDto> GetReconciliationAsync(DateTime from, DateTime to);
}

public class PaymentService : IPaymentService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PaymentService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<PaymentOrderDto> CreateOrderAsync(Guid customerId, CreatePaymentOrderRequest request)
    {
        var booking = await _db.Bookings.FindAsync(request.BookingId)
            ?? throw new KeyNotFoundException("Booking not found");

        var gst = PricingEngine.CalculateGst(request.Amount);
        var totalAmount = request.Amount + gst;

        // In production: call Razorpay Orders API
        var razorpayOrderId = $"order_{Guid.NewGuid():N}";

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            BookingId = request.BookingId,
            Amount = totalAmount,
            GstAmount = gst,
            RazorpayOrderId = razorpayOrderId,
            Status = PaymentStatus.Created
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        return new PaymentOrderDto(payment.Id, razorpayOrderId, totalAmount, request.Currency, "Created");
    }

    public async Task HandleRazorpayWebhookAsync(string payload, string signature)
    {
        // In production: verify HMAC signature with Razorpay webhook secret
        // Parse payload and update payment status
        await Task.CompletedTask;
    }

    public async Task<PagedResult<PaymentRecordDto>> GetHistoryAsync(Guid customerId, int page, int pageSize)
    {
        var query = _db.Payments.Where(p => p.CustomerId == customerId);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<PaymentRecordDto>(
            items.Select(p => new PaymentRecordDto(
                p.Id, p.BookingId, p.Amount, p.Currency, p.Status.ToString(),
                p.Method, p.CreatedAt, p.InvoiceUrl)).ToList(),
            page, pageSize, total);
    }

    public async Task<FinanceReconciliationDto> GetReconciliationAsync(DateTime from, DateTime to)
    {
        var payments = await _db.Payments
            .Where(p => p.CreatedAt >= from && p.CreatedAt <= to)
            .ToListAsync();

        var collected = payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount);
        var refunded = payments.Where(p => p.Status == PaymentStatus.Refunded).Sum(p => p.Amount);
        var gst = payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.GstAmount);
        var unmatched = payments.Count(p => p.Status == PaymentStatus.Paid && p.ReconciledAt is null);

        return new FinanceReconciliationDto(
            collected, refunded, collected - refunded, gst, unmatched,
            payments.Select(p => new ReconciliationItemDto(
                p.Id, p.RazorpayPaymentId, p.Amount, p.Status.ToString(), p.ReconciledAt)).ToList());
    }
}

public interface INotificationService
{
    Task SendPushAsync(Guid customerId, string title, string body);
    Task SendSmsAsync(string phone, string message);
    Task NotifyRideStartedAsync(Guid customerId, Guid rideId);
    Task NotifyRideEndedAsync(Guid customerId, Guid rideId, decimal fare);
    Task NotifyKycApprovedAsync(Guid customerId);
}

public class NotificationService : INotificationService
{
    public Task SendPushAsync(Guid customerId, string title, string body)
    {
        // In production: Firebase Cloud Messaging
        Console.WriteLine($"[PUSH] {customerId}: {title} - {body}");
        return Task.CompletedTask;
    }

    public Task SendSmsAsync(string phone, string message)
    {
        Console.WriteLine($"[SMS] {phone}: {message}");
        return Task.CompletedTask;
    }

    public Task NotifyRideStartedAsync(Guid customerId, Guid rideId) =>
        SendPushAsync(customerId, "Ride Started", "Your ride has begun. Ride safe!");

    public Task NotifyRideEndedAsync(Guid customerId, Guid rideId, decimal fare) =>
        SendPushAsync(customerId, "Ride Ended", $"Your ride has ended. Fare: ₹{fare:F2}");

    public Task NotifyKycApprovedAsync(Guid customerId) =>
        SendPushAsync(customerId, "KYC Approved", "Your identity verification is complete. You can now book rides!");
}
