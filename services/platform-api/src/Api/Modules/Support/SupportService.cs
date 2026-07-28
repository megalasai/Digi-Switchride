using Microsoft.EntityFrameworkCore;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.Support;

public interface ISupportService
{
    Task<SupportTicketDto> CreateAsync(Guid customerId, CreateTicketRequest request);
    Task<List<SupportTicketDto>> ListAsync(Guid customerId);
}

public class SupportService : ISupportService
{
    private readonly AppDbContext _db;
    public SupportService(AppDbContext db) => _db = db;

    public async Task<SupportTicketDto> CreateAsync(Guid customerId, CreateTicketRequest request)
    {
        var ticket = new SupportTicket
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            Category = Enum.Parse<TicketCategory>(request.Category),
            Subject = request.Subject,
            Description = request.Description,
            BookingId = request.BookingId
        };
        _db.SupportTickets.Add(ticket);
        await _db.SaveChangesAsync();
        return Map(ticket);
    }

    public async Task<List<SupportTicketDto>> ListAsync(Guid customerId)
    {
        return await _db.SupportTickets
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => Map(t))
            .ToListAsync();
    }

    private static SupportTicketDto Map(SupportTicket t) =>
        new(t.Id, t.Category.ToString(), t.Subject, t.Description, t.Status.ToString(), t.CreatedAt);
}

namespace PlatformApi.Modules.Reports;

public interface IReportService
{
    Task<ReportSummaryDto> GetSummaryAsync(DateTime from, DateTime to);
}

public class ReportService : IReportService
{
    private readonly AppDbContext _db;
    public ReportService(AppDbContext db) => _db = db;

    public async Task<ReportSummaryDto> GetSummaryAsync(DateTime from, DateTime to)
    {
        var rides = await _db.Rides
            .Where(r => r.Status == RideStatus.Ended && r.EndedAt >= from && r.EndedAt <= to)
            .ToListAsync();

        var payments = await _db.Payments
            .Where(p => p.Status == PaymentStatus.Paid && p.PaidAt >= from && p.PaidAt <= to)
            .ToListAsync();

        var totalVehicles = await _db.Vehicles.CountAsync();
        var inRide = await _db.Vehicles.CountAsync(v => v.Status == VehicleStatus.InRide);
        var newCustomers = await _db.Customers.CountAsync(c => c.CreatedAt >= from && c.CreatedAt <= to);

        var avgDuration = rides.Count > 0
            ? rides.Where(r => r.DurationMinutes.HasValue).Average(r => r.DurationMinutes!.Value)
            : 0;

        return new ReportSummaryDto(
            rides.Count,
            payments.Sum(p => p.Amount),
            inRide,
            totalVehicles > 0 ? (double)inRide / totalVehicles * 100 : 0,
            newCustomers,
            avgDuration);
    }
}

namespace PlatformApi.Modules.Promotions;

public interface IPromotionService
{
    Task<PromotionDto> CreateAsync(CreatePromotionRequest request);
    Task<List<PromotionDto>> ListAsync();
}

public class PromotionService : IPromotionService
{
    private readonly AppDbContext _db;
    public PromotionService(AppDbContext db) => _db = db;

    public async Task<PromotionDto> CreateAsync(CreatePromotionRequest request)
    {
        var promo = new Promotion
        {
            Id = Guid.NewGuid(),
            Code = request.Code,
            Description = request.Description,
            DiscountType = Enum.Parse<DiscountType>(request.DiscountType),
            DiscountValue = request.DiscountValue,
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo,
            MaxUses = request.MaxUses
        };
        _db.Promotions.Add(promo);
        await _db.SaveChangesAsync();
        return Map(promo);
    }

    public async Task<List<PromotionDto>> ListAsync()
    {
        return await _db.Promotions.Select(p => Map(p)).ToListAsync();
    }

    private static PromotionDto Map(Promotion p) => new(
        p.Id, p.Code, p.Description, p.DiscountType.ToString(), p.DiscountValue,
        p.ValidFrom, p.ValidTo, p.MaxUses, p.CurrentUses, p.IsActive);
}
