namespace PlatformApi.Shared.Dtos;

public record SendOtpRequest(string Phone);
public record SendOtpResponse(string Message, int ExpiresInSeconds);
public record VerifyOtpRequest(string Phone, string Otp);
public record AuthTokens(string AccessToken, string RefreshToken, int ExpiresIn, bool IsNewUser);
public record RefreshTokenRequest(string RefreshToken);

public record CustomerProfileDto(
    Guid Id, string Phone, string? Email, string? FullName,
    string KycStatus, string AccountStatus, DateTime CreatedAt);

public record UpdateProfileRequest(string? Email, string? FullName, string? EmergencyContact);

public record KycSubmissionDto(Guid Id, string DocumentType, string Status, DateTime SubmittedAt);
public record KycStatusDto(string Status, List<KycSubmissionDto> Submissions, string? RejectionReason);
public record KycReviewRequest(string Action, string? Reason);

public record GeoPointDto(double Lat, double Lng);

public record RentalHubSummaryDto(
    Guid Id, string Name, GeoPointDto Location, double DistanceKm,
    int AvailableVehicles, string Status);

public record RentalHubDto(
    Guid Id, string Name, GeoPointDto Location, double DistanceKm,
    int AvailableVehicles, string Status, string Address, int Capacity,
    string? OperatingHours, double GeoFenceRadiusM);

public record CreateHubRequest(string Name, GeoPointDto Location, string Address, int Capacity, string? OperatingHours, double GeoFenceRadiusM);

public record VehicleSummaryDto(
    Guid Id, string RegistrationNumber, string Type, string Status,
    int BatteryPercent, string Model);

public record VehicleDto(
    Guid Id, string RegistrationNumber, string Type, string Status,
    int BatteryPercent, string Model, Guid HubId, double OdometerKm,
    string? IoTDeviceId, string? PricingTier);

public record CreateVehicleRequest(
    string RegistrationNumber, string Type, Guid HubId, string Model, string? IoTDeviceId);

public record CreateBookingRequest(Guid VehicleId, string BookingType, string? PromoCode);
public record BookingDto(
    Guid Id, Guid CustomerId, Guid VehicleId, Guid HubId, string BookingType,
    string Status, decimal EstimatedAmount, string Currency, Guid? RideId,
    DateTime CreatedAt, DateTime? StartTime, DateTime? EndTime);

public record PagedResult<T>(List<T> Items, int Page, int PageSize, int TotalCount);

public record StartRideRequest(string? IdempotencyKey, GeoPointDto? Location);
public record EndRideRequest(string? IdempotencyKey, GeoPointDto? Location);

public record RideDto(
    Guid Id, Guid BookingId, Guid VehicleId, string Status,
    DateTime? StartedAt, DateTime? EndedAt, GeoPointDto? StartLocation,
    GeoPointDto? EndLocation, int? DurationMinutes, double? DistanceKm);

public record RideEndResultDto(RideDto Ride, decimal Fare, Guid? PaymentId, string? InvoiceUrl);

public record CreatePaymentOrderRequest(Guid BookingId, decimal Amount, string Currency);
public record PaymentOrderDto(Guid Id, string? RazorpayOrderId, decimal Amount, string Currency, string Status);
public record PaymentRecordDto(
    Guid Id, Guid BookingId, decimal Amount, string Currency, string Status,
    string? Method, DateTime CreatedAt, string? InvoiceUrl);

public record CreateTicketRequest(string Category, string Subject, string Description, Guid? BookingId);
public record SupportTicketDto(
    Guid Id, string Category, string Subject, string Description, string Status, DateTime CreatedAt);

public record CreatePromotionRequest(
    string Code, string? Description, string DiscountType, decimal DiscountValue,
    DateTime ValidFrom, DateTime ValidTo, int? MaxUses);

public record PromotionDto(
    Guid Id, string Code, string? Description, string DiscountType, decimal DiscountValue,
    DateTime ValidFrom, DateTime ValidTo, int? MaxUses, int CurrentUses, bool IsActive);

public record ReportSummaryDto(
    int TotalRides, decimal TotalRevenue, int ActiveVehicles,
    double FleetUtilizationPercent, int NewCustomers, double AverageRideDurationMinutes);

public record FinanceReconciliationDto(
    decimal TotalCollected, decimal TotalRefunded, decimal NetRevenue,
    decimal GstAmount, int UnmatchedPayments, List<ReconciliationItemDto> Items);

public record ReconciliationItemDto(
    Guid PaymentId, string? RazorpayPaymentId, decimal Amount, string Status, DateTime? ReconciledAt);

public record IoTDeviceDto(
    string Id, Guid? VehicleId, string VendorType, string ConnectionStatus,
    DateTime? LastSeenAt, int? BatteryPercent, GeoPointDto? LastLocation);

public record IoTCommandRequest(string Command);
public record IoTCommandResponse(Guid CommandId, string Status);

public record ErrorDto(string Code, string Message, object? Details = null);
