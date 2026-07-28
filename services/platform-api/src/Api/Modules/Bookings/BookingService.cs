using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using PlatformApi.Modules.IoT;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.Bookings;

public interface IBookingService
{
    Task<BookingDto> CreateAsync(Guid customerId, CreateBookingRequest request);
    Task<BookingDto> GetAsync(Guid bookingId);
    Task<PagedResult<BookingDto>> ListAsync(Guid customerId, BookingStatus? status, int page, int pageSize);
    Task<BookingDto> CancelAsync(Guid bookingId, string? reason);
    Task<PagedResult<BookingDto>> AdminListAsync(BookingStatus? status, int page, int pageSize);
}

public class BookingService : IBookingService
{
    private readonly AppDbContext _db;

    public BookingService(AppDbContext db) => _db = db;

    public async Task<BookingDto> CreateAsync(Guid customerId, CreateBookingRequest request)
    {
        var customer = await _db.Customers.FindAsync(customerId)
            ?? throw new KeyNotFoundException("Customer not found");

        if (customer.KycStatus != KycStatusEnum.Approved)
            throw new InvalidOperationException("KYC must be approved before booking");

        var vehicle = await _db.Vehicles.FindAsync(request.VehicleId)
            ?? throw new KeyNotFoundException("Vehicle not found");

        if (vehicle.Status != VehicleStatus.Available)
            throw new InvalidOperationException("Vehicle is not available");

        decimal estimated = PricingEngine.EstimateFare(request.BookingType);
        if (request.PromoCode is not null)
        {
            var promo = await _db.Promotions.FirstOrDefaultAsync(p =>
                p.Code == request.PromoCode && p.IsActive &&
                p.ValidFrom <= DateTime.UtcNow && p.ValidTo >= DateTime.UtcNow);
            if (promo is not null)
            {
                estimated = promo.DiscountType == DiscountType.Percentage
                    ? estimated * (1 - promo.DiscountValue / 100)
                    : Math.Max(0, estimated - promo.DiscountValue);
                promo.CurrentUses++;
            }
        }

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            VehicleId = vehicle.Id,
            HubId = vehicle.HubId,
            BookingType = Enum.Parse<BookingType>(request.BookingType),
            Status = BookingStatus.Confirmed,
            EstimatedAmount = estimated
        };

        vehicle.Status = VehicleStatus.Reserved;
        var ride = new Ride
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            VehicleId = vehicle.Id,
            CustomerId = customerId
        };

        _db.Bookings.Add(booking);
        _db.Rides.Add(ride);
        await _db.SaveChangesAsync();

        return Map(booking, ride.Id);
    }

    public async Task<BookingDto> GetAsync(Guid bookingId)
    {
        var b = await _db.Bookings.Include(b => b.Ride).FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found");
        return Map(b, b.Ride?.Id);
    }

    public async Task<PagedResult<BookingDto>> ListAsync(Guid customerId, BookingStatus? status, int page, int pageSize)
    {
        var query = _db.Bookings.Include(b => b.Ride).Where(b => b.CustomerId == customerId);
        if (status.HasValue) query = query.Where(b => b.Status == status.Value);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<BookingDto>(
            items.Select(b => Map(b, b.Ride?.Id)).ToList(), page, pageSize, total);
    }

    public async Task<BookingDto> CancelAsync(Guid bookingId, string? reason)
    {
        var booking = await _db.Bookings.Include(b => b.Vehicle).Include(b => b.Ride)
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found");

        if (booking.Status is BookingStatus.Completed or BookingStatus.Cancelled)
            throw new InvalidOperationException("Cannot cancel this booking");

        booking.Status = BookingStatus.Cancelled;
        booking.Vehicle.Status = VehicleStatus.Available;
        await _db.SaveChangesAsync();
        return Map(booking, booking.Ride?.Id);
    }

    public async Task<PagedResult<BookingDto>> AdminListAsync(BookingStatus? status, int page, int pageSize)
    {
        var query = _db.Bookings.Include(b => b.Ride).AsQueryable();
        if (status.HasValue) query = query.Where(b => b.Status == status.Value);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<BookingDto>(
            items.Select(b => Map(b, b.Ride?.Id)).ToList(), page, pageSize, total);
    }

    private static BookingDto Map(Booking b, Guid? rideId) => new(
        b.Id, b.CustomerId, b.VehicleId, b.HubId, b.BookingType.ToString(),
        b.Status.ToString(), b.EstimatedAmount, b.Currency, rideId,
        b.CreatedAt, b.StartTime, b.EndTime);
}

public interface IRideService
{
    Task<RideDto> StartAsync(Guid rideId, Guid customerId, StartRideRequest request);
    Task<RideEndResultDto> EndAsync(Guid rideId, Guid customerId, EndRideRequest request);
    Task<RideDto?> GetActiveAsync(Guid customerId);
    Task<PagedResult<RideDto>> GetHistoryAsync(Guid customerId, int page, int pageSize);
    Task<List<RideDto>> GetActiveRidesAdminAsync();
}

public class RideService : IRideService
{
    private readonly AppDbContext _db;
    private readonly IIoTCommandService _iot;
    private static readonly GeometryFactory Gf = new(new PrecisionModel(), 4326);

    public RideService(AppDbContext db, IIoTCommandService iot)
    {
        _db = db;
        _iot = iot;
    }

    public async Task<RideDto> StartAsync(Guid rideId, Guid customerId, StartRideRequest request)
    {
        var ride = await _db.Rides
            .Include(r => r.Booking).ThenInclude(b => b.Vehicle)
            .FirstOrDefaultAsync(r => r.Id == rideId && r.CustomerId == customerId)
            ?? throw new KeyNotFoundException("Ride not found");

        if (ride.Status == RideStatus.InProgress)
            return Map(ride);

        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            var existing = await _db.Rides.FirstOrDefaultAsync(r => r.StartIdempotencyKey == request.IdempotencyKey);
            if (existing is not null) return Map(existing);
        }

        if (ride.Booking.CustomerId != customerId)
            throw new UnauthorizedAccessException();

        ride.Status = RideStatus.InProgress;
        ride.StartedAt = DateTime.UtcNow;
        ride.StartIdempotencyKey = request.IdempotencyKey;
        if (request.Location is not null)
            ride.StartLocation = Gf.CreatePoint(new Coordinate(request.Location.Lng, request.Location.Lat));

        ride.Booking.Status = BookingStatus.Active;
        ride.Booking.StartTime = ride.StartedAt;
        ride.Booking.Vehicle.Status = VehicleStatus.InRide;

        if (ride.Booking.Vehicle.IoTDeviceId is not null)
            await _iot.SendCommandAsync(ride.Booking.Vehicle.IoTDeviceId, "Unlock");

        await _db.SaveChangesAsync();
        return Map(ride);
    }

    public async Task<RideEndResultDto> EndAsync(Guid rideId, Guid customerId, EndRideRequest request)
    {
        var ride = await _db.Rides
            .Include(r => r.Booking).ThenInclude(b => b.Vehicle)
            .FirstOrDefaultAsync(r => r.Id == rideId && r.CustomerId == customerId)
            ?? throw new KeyNotFoundException("Ride not found");

        if (ride.Status == RideStatus.Ended)
        {
            return new RideEndResultDto(Map(ride), ride.FinalFare ?? 0, null, null);
        }

        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            var existing = await _db.Rides.FirstOrDefaultAsync(r => r.EndIdempotencyKey == request.IdempotencyKey);
            if (existing?.Status == RideStatus.Ended)
                return new RideEndResultDto(Map(existing), existing.FinalFare ?? 0, null, null);
        }

        ride.Status = RideStatus.Ended;
        ride.EndedAt = DateTime.UtcNow;
        ride.EndIdempotencyKey = request.IdempotencyKey;
        if (request.Location is not null)
            ride.EndLocation = Gf.CreatePoint(new Coordinate(request.Location.Lng, request.Location.Lat));

        ride.DurationMinutes = (int)(ride.EndedAt.Value - ride.StartedAt!.Value).TotalMinutes;
        ride.FinalFare = PricingEngine.CalculateRideFare(
            ride.DurationMinutes.Value, ride.DistanceKm ?? 0,
            ride.Booking.BookingType.ToString());

        ride.Booking.Status = BookingStatus.Completed;
        ride.Booking.EndTime = ride.EndedAt;
        ride.Booking.Vehicle.Status = VehicleStatus.Available;

        if (ride.Booking.Vehicle.IoTDeviceId is not null)
            await _iot.SendCommandAsync(ride.Booking.Vehicle.IoTDeviceId, "Lock");

        var gst = PricingEngine.CalculateGst(ride.FinalFare.Value);
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            BookingId = ride.BookingId,
            Amount = ride.FinalFare.Value + gst,
            GstAmount = gst,
            Status = PaymentStatus.Created
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        return new RideEndResultDto(Map(ride), ride.FinalFare.Value, payment.Id, null);
    }

    public async Task<RideDto?> GetActiveAsync(Guid customerId)
    {
        var ride = await _db.Rides.FirstOrDefaultAsync(r =>
            r.CustomerId == customerId && r.Status == RideStatus.InProgress);
        return ride is null ? null : Map(ride);
    }

    public async Task<PagedResult<RideDto>> GetHistoryAsync(Guid customerId, int page, int pageSize)
    {
        var query = _db.Rides.Where(r => r.CustomerId == customerId && r.Status == RideStatus.Ended);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(r => r.EndedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<RideDto>(items.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<List<RideDto>> GetActiveRidesAdminAsync()
    {
        return await _db.Rides.Where(r => r.Status == RideStatus.InProgress)
            .Select(r => Map(r)).ToListAsync();
    }

    private static RideDto Map(Ride r) => new(
        r.Id, r.BookingId, r.VehicleId, r.Status.ToString(),
        r.StartedAt, r.EndedAt,
        r.StartLocation is not null ? new GeoPointDto(r.StartLocation.Y, r.StartLocation.X) : null,
        r.EndLocation is not null ? new GeoPointDto(r.EndLocation.Y, r.EndLocation.X) : null,
        r.DurationMinutes, r.DistanceKm);
}
