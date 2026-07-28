using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlatformApi.Modules.Bookings;
using PlatformApi.Modules.Fleet;
using PlatformApi.Modules.Identity;
using PlatformApi.Modules.Payments;
using PlatformApi.Modules.Support;
using PlatformApi.Modules.UsersKyc;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Controllers;

[ApiController]
[Route("v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    public AuthController(IAuthService auth) => _auth = auth;

    [HttpPost("otp/send")]
    public async Task<ActionResult<SendOtpResponse>> SendOtp([FromBody] SendOtpRequest request) =>
        Ok(await _auth.SendOtpAsync(request));

    [HttpPost("otp/verify")]
    public async Task<ActionResult<AuthTokens>> VerifyOtp([FromBody] VerifyOtpRequest request) =>
        Ok(await _auth.VerifyOtpAsync(request));

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthTokens>> Refresh([FromBody] RefreshTokenRequest request) =>
        Ok(await _auth.RefreshTokenAsync(request.RefreshToken));
}

[ApiController]
[Route("v1/me")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profile;
    private readonly IAuthService _auth;

    public ProfileController(IProfileService profile, IAuthService auth)
    {
        _profile = profile;
        _auth = auth;
    }

    private Guid CustomerId => _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();

    [HttpGet]
    public async Task<ActionResult<CustomerProfileDto>> Get() =>
        Ok(await _profile.GetAsync(CustomerId));

    [HttpPut]
    public async Task<ActionResult<CustomerProfileDto>> Update([FromBody] UpdateProfileRequest request) =>
        Ok(await _profile.UpdateAsync(CustomerId, request));
}

[ApiController]
[Route("v1/kyc")]
[Authorize]
public class KycController : ControllerBase
{
    private readonly IKycService _kyc;
    private readonly IAuthService _auth;

    public KycController(IKycService kyc, IAuthService auth)
    {
        _kyc = kyc;
        _auth = auth;
    }

    private Guid CustomerId => _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();

    [HttpPost("submissions")]
    public async Task<ActionResult<KycSubmissionDto>> Submit(
        [FromForm] string documentType,
        [FromForm] string? documentNumber,
        IFormFile? file)
    {
        Stream? stream = file?.OpenReadStream();
        var result = await _kyc.SubmitAsync(
            CustomerId,
            Enum.Parse<KycDocumentType>(documentType),
            documentNumber, stream, file?.FileName);
        return Created("", result);
    }

    [HttpGet("status")]
    public async Task<ActionResult<KycStatusDto>> GetStatus() =>
        Ok(await _kyc.GetStatusAsync(CustomerId));
}

[ApiController]
[Route("v1/hubs")]
[Authorize]
public class HubsController : ControllerBase
{
    private readonly IFleetService _fleet;
    public HubsController(IFleetService fleet) => _fleet = fleet;

    [HttpGet("nearby")]
    public async Task<ActionResult<object>> Nearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm = 5) =>
        Ok(new { items = await _fleet.GetNearbyHubsAsync(lat, lng, radiusKm) });

    [HttpGet("{hubId}")]
    public async Task<ActionResult<RentalHubDto>> Get(Guid hubId, [FromQuery] double? lat, [FromQuery] double? lng) =>
        Ok(await _fleet.GetHubAsync(hubId, lat, lng));

    [HttpGet("{hubId}/vehicles")]
    public async Task<ActionResult<object>> Vehicles(Guid hubId, [FromQuery] VehicleStatus? status) =>
        Ok(new { items = await _fleet.GetHubVehiclesAsync(hubId, status) });
}

[ApiController]
[Route("v1/vehicles")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly IFleetService _fleet;
    public VehiclesController(IFleetService fleet) => _fleet = fleet;

    [HttpGet("{vehicleId}")]
    public async Task<ActionResult<VehicleDto>> Get(Guid vehicleId) =>
        Ok(await _fleet.GetVehicleAsync(vehicleId));
}

[ApiController]
[Route("v1/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _bookings;
    private readonly IAuthService _auth;

    public BookingsController(IBookingService bookings, IAuthService auth)
    {
        _bookings = bookings;
        _auth = auth;
    }

    private Guid CustomerId => _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();

    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create([FromBody] CreateBookingRequest request)
    {
        var result = await _bookings.CreateAsync(CustomerId, request);
        return Created("", result);
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<BookingDto>>> List(
        [FromQuery] BookingStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await _bookings.ListAsync(CustomerId, status, page, pageSize));

    [HttpGet("{bookingId}")]
    public async Task<ActionResult<BookingDto>> Get(Guid bookingId) =>
        Ok(await _bookings.GetAsync(bookingId));

    [HttpPost("{bookingId}/cancel")]
    public async Task<ActionResult<BookingDto>> Cancel(Guid bookingId, [FromBody] object? body) =>
        Ok(await _bookings.CancelAsync(bookingId, null));
}

[ApiController]
[Route("v1/rides")]
[Authorize]
public class RidesController : ControllerBase
{
    private readonly IRideService _rides;
    private readonly IAuthService _auth;

    public RidesController(IRideService rides, IAuthService auth)
    {
        _rides = rides;
        _auth = auth;
    }

    private Guid CustomerId => _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();

    [HttpPost("{rideId}/start")]
    public async Task<ActionResult<RideDto>> Start(Guid rideId, [FromBody] StartRideRequest? request) =>
        Ok(await _rides.StartAsync(rideId, CustomerId, request ?? new StartRideRequest(null, null)));

    [HttpPost("{rideId}/end")]
    public async Task<ActionResult<RideEndResultDto>> End(Guid rideId, [FromBody] EndRideRequest? request) =>
        Ok(await _rides.EndAsync(rideId, CustomerId, request ?? new EndRideRequest(null, null)));

    [HttpGet("active")]
    public async Task<ActionResult<RideDto>> Active()
    {
        var ride = await _rides.GetActiveAsync(CustomerId);
        return ride is null ? NoContent() : Ok(ride);
    }

    [HttpGet("history")]
    public async Task<ActionResult<PagedResult<RideDto>>> History(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await _rides.GetHistoryAsync(CustomerId, page, pageSize));
}

[ApiController]
[Route("v1/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _payments;
    private readonly IAuthService _auth;

    public PaymentsController(IPaymentService payments, IAuthService auth)
    {
        _payments = payments;
        _auth = auth;
    }

    [HttpPost("orders")]
    [Authorize]
    public async Task<ActionResult<PaymentOrderDto>> CreateOrder([FromBody] CreatePaymentOrderRequest request)
    {
        var customerId = _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();
        var result = await _payments.CreateOrderAsync(customerId, request);
        return Created("", result);
    }

    [HttpPost("webhooks/razorpay")]
    public async Task<IActionResult> RazorpayWebhook()
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();
        var signature = Request.Headers["X-Razorpay-Signature"].ToString();
        await _payments.HandleRazorpayWebhookAsync(payload, signature);
        return Ok();
    }

    [HttpGet("history")]
    [Authorize]
    public async Task<ActionResult<PagedResult<PaymentRecordDto>>> History(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var customerId = _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();
        return Ok(await _payments.GetHistoryAsync(customerId, page, pageSize));
    }
}

[ApiController]
[Route("v1/support")]
[Authorize]
public class SupportController : ControllerBase
{
    private readonly ISupportService _support;
    private readonly IAuthService _auth;

    public SupportController(ISupportService support, IAuthService auth)
    {
        _support = support;
        _auth = auth;
    }

    private Guid CustomerId => _auth.GetCustomerId(User)! ?? throw new UnauthorizedAccessException();

    [HttpPost("tickets")]
    public async Task<ActionResult<SupportTicketDto>> Create([FromBody] CreateTicketRequest request)
    {
        var result = await _support.CreateAsync(CustomerId, request);
        return Created("", result);
    }

    [HttpGet("tickets")]
    public async Task<ActionResult<object>> List() =>
        Ok(new { items = await _support.ListAsync(CustomerId) });
}
