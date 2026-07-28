using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlatformApi.Modules.Bookings;
using PlatformApi.Modules.Fleet;
using PlatformApi.Modules.IoT;
using PlatformApi.Modules.Payments;
using PlatformApi.Modules.Promotions;
using PlatformApi.Modules.Reports;
using PlatformApi.Modules.UsersKyc;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Controllers;

[ApiController]
[Route("v1/admin")]
[Authorize(Roles = "Admin,SuperAdmin,HubOperator,FleetManager,Finance,SupportAgent")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IKycService _kyc;
    private readonly IFleetService _fleet;
    private readonly IBookingService _bookings;
    private readonly IRideService _rides;
    private readonly IPromotionService _promotions;
    private readonly IReportService _reports;
    private readonly IPaymentService _payments;
    private readonly IIoTCommandService _iot;

    public AdminController(
        AppDbContext db, IKycService kyc, IFleetService fleet,
        IBookingService bookings, IRideService rides,
        IPromotionService promotions, IReportService reports,
        IPaymentService payments, IIoTCommandService iot)
    {
        _db = db;
        _kyc = kyc;
        _fleet = fleet;
        _bookings = bookings;
        _rides = rides;
        _promotions = promotions;
        _reports = reports;
        _payments = payments;
        _iot = iot;
    }

    [HttpGet("customers")]
    public async Task<ActionResult<PagedResult<CustomerProfileDto>>> ListCustomers(
        [FromQuery] string? search, [FromQuery] KycStatusEnum? kycStatus,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Customers.AsQueryable();
        if (!string.IsNullOrEmpty(search))
            query = query.Where(c => c.Phone.Contains(search) || (c.FullName != null && c.FullName.Contains(search)));
        if (kycStatus.HasValue)
            query = query.Where(c => c.KycStatus == kycStatus.Value);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => new CustomerProfileDto(
                c.Id, c.Phone, c.Email, c.FullName,
                c.KycStatus.ToString(), c.AccountStatus.ToString(), c.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResult<CustomerProfileDto>(items, page, pageSize, total));
    }

    [HttpPost("customers/{customerId}/kyc/review")]
    public async Task<IActionResult> ReviewKyc(Guid customerId, [FromBody] KycReviewRequest request)
    {
        await _kyc.ReviewAsync(customerId, request, Guid.Empty);
        return Ok();
    }

    [HttpGet("hubs")]
    public async Task<ActionResult<object>> ListHubs() =>
        Ok(new { items = await _fleet.ListAllHubsAsync() });

    [HttpPost("hubs")]
    public async Task<ActionResult<RentalHubDto>> CreateHub([FromBody] CreateHubRequest request)
    {
        var result = await _fleet.CreateHubAsync(request);
        return Created("", result);
    }

    [HttpGet("vehicles")]
    public async Task<ActionResult<object>> ListVehicles() =>
        Ok(new { items = await _fleet.ListAllVehiclesAsync() });

    [HttpPost("vehicles")]
    public async Task<ActionResult<VehicleDto>> CreateVehicle([FromBody] CreateVehicleRequest request)
    {
        var result = await _fleet.CreateVehicleAsync(request);
        return Created("", result);
    }

    [HttpGet("bookings")]
    public async Task<ActionResult<PagedResult<BookingDto>>> ListBookings(
        [FromQuery] BookingStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await _bookings.AdminListAsync(status, page, pageSize));

    [HttpGet("rides/active")]
    public async Task<ActionResult<object>> ActiveRides() =>
        Ok(new { items = await _rides.GetActiveRidesAdminAsync() });

    [HttpGet("promotions")]
    public async Task<ActionResult<object>> ListPromotions() =>
        Ok(new { items = await _promotions.ListAsync() });

    [HttpPost("promotions")]
    public async Task<ActionResult<PromotionDto>> CreatePromotion([FromBody] CreatePromotionRequest request)
    {
        var result = await _promotions.CreateAsync(request);
        return Created("", result);
    }

    [HttpGet("reports/summary")]
    public async Task<ActionResult<ReportSummaryDto>> ReportSummary(
        [FromQuery] DateTime from, [FromQuery] DateTime to) =>
        Ok(await _reports.GetSummaryAsync(from, to));

    [HttpGet("finance/reconciliation")]
    public async Task<ActionResult<FinanceReconciliationDto>> Reconciliation(
        [FromQuery] DateTime from, [FromQuery] DateTime to) =>
        Ok(await _payments.GetReconciliationAsync(from, to));

    [HttpGet("iot/devices")]
    public async Task<ActionResult<object>> ListIoTDevices() =>
        Ok(new { items = await _iot.ListDevicesAsync() });

    [HttpPost("iot/devices/{deviceId}/command")]
    public async Task<ActionResult<IoTCommandResponse>> SendIoTCommand(
        string deviceId, [FromBody] IoTCommandRequest request) =>
        Ok(await _iot.SendCommandAsync(deviceId, request.Command));
}
