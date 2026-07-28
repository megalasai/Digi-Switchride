using PlatformApi.Shared.Domain;

namespace PlatformApi.Modules.Payments;

public interface IInvoiceService
{
    Task<string> GenerateInvoiceAsync(Payment payment, Booking booking, Customer customer);
}

public class InvoiceService : IInvoiceService
{
    public Task<string> GenerateInvoiceAsync(Payment payment, Booking booking, Customer customer)
    {
        var invoiceNumber = $"INV-{payment.Id.ToString()[..8].ToUpper()}";
        var subtotal = payment.Amount - payment.GstAmount;
        var gstRate = subtotal > 0 ? payment.GstAmount / subtotal * 100 : 5m;

        var invoice = $"""
            TAX INVOICE
            Invoice No: {invoiceNumber}
            Date: {payment.PaidAt?.ToString("dd/MM/yyyy") ?? DateTime.UtcNow.ToString("dd/MM/yyyy")}
            
            Customer: {customer.FullName ?? customer.Phone}
            Phone: {customer.Phone}
            
            Booking ID: {booking.Id}
            Booking Type: {booking.BookingType}
            
            Subtotal: ₹{subtotal:F2}
            GST ({gstRate:F0}%): ₹{payment.GstAmount:F2}
            Total: ₹{payment.Amount:F2}
            
            Payment Method: {payment.Method ?? "UPI/Card"}
            Razorpay Payment ID: {payment.RazorpayPaymentId ?? "Pending"}
            """;

        var blobUrl = $"exports/invoices/{invoiceNumber}.txt";
        return Task.FromResult(blobUrl);
    }
}
