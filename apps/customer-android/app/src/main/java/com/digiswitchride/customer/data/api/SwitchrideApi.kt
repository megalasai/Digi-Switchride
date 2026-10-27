package com.digiswitchride.customer.data.api

import retrofit2.http.*

data class RegisterRequest(val username: String, val password: String, val fullName: String? = null)
data class LoginRequest(val username: String, val password: String)
data class AuthTokens(val accessToken: String, val refreshToken: String, val expiresIn: Int, val isNewUser: Boolean)
data class CustomerProfile(
    val id: String,
    val username: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val kycStatus: String,
    val accountStatus: String? = null,
    val walletBalance: Double? = 0.0,
    val referralCode: String? = null,
    val address: String? = null,
    val assignedVehicleId: String? = null,
    val rentalPlanId: String? = null,
)
data class RiderPlan(
    val id: String,
    val name: String,
    val charges: Double,
    val durationDays: Int,
    val billingFrequency: String,
    val eligibility: String? = null,
    val terms: String? = null,
    val isActive: Boolean = true,
)
data class RiderVehicle(
    val id: String,
    val registrationNumber: String,
    val type: String,
    val wheelClass: String? = null,
    val model: String,
    val status: String,
    val batteryPercent: Int,
    val lastLat: Double? = null,
    val lastLng: Double? = null,
)
data class Outstanding(val count: Int, val amount: Double)
data class RiderAlert(val id: String, val title: String, val body: String, val status: String? = null)
data class BreakdownItem(
    val id: String,
    val issueType: String,
    val description: String,
    val status: String,
    val assignedTo: String? = null,
)
data class ServiceItem(
    val id: String,
    val category: String,
    val description: String,
    val status: String,
)
data class PaymentGatewayInfo(
    val enabled: Boolean = false,
    val provider: String? = null,
    val displayName: String? = null,
    val methods: List<String> = listOf("Wallet"),
)
data class HomeResponse(
    val rider: CustomerProfile,
    val plan: RiderPlan? = null,
    val vehicle: RiderVehicle? = null,
    val walletBalance: Double = 0.0,
    val outstanding: Outstanding,
    val alerts: List<RiderAlert> = emptyList(),
    val breakdown: BreakdownItem? = null,
    val service: ServiceItem? = null,
    val paymentGateway: PaymentGatewayInfo? = null,
)
data class VehicleResponse(
    val vehicle: RiderVehicle? = null,
    val breakdowns: List<BreakdownItem> = emptyList(),
    val requests: List<ServiceItem> = emptyList(),
)
data class PaymentItem(
    val id: String,
    val amount: Double,
    val currency: String? = "INR",
    val status: String,
    val method: String? = null,
    val reference: String? = null,
    val createdAt: String? = null,
)
data class PaymentsResponse(val items: List<PaymentItem> = emptyList())
data class WalletItem(val id: String, val type: String, val amount: Double, val note: String? = null, val balanceAfter: Double, val createdAt: String? = null)
data class WalletResponse(val items: List<WalletItem> = emptyList())
data class PlansResponse(val currentPlanId: String? = null, val items: List<RiderPlan> = emptyList())
data class AgreementItem(val id: String, val type: String, val content: String, val status: String, val documentUrl: String? = null)
data class AgreementsResponse(val items: List<AgreementItem> = emptyList())
data class StationItem(val id: String, val name: String, val address: String, val chargerCount: Int, val status: String, val operatingHours: String? = null)
data class StationsResponse(val items: List<StationItem> = emptyList())
data class CentreItem(val id: String, val name: String, val address: String, val contactPhone: String, val isActive: Boolean = true)
data class CentresResponse(val items: List<CentreItem> = emptyList())
data class SlotItem(val id: String, val centreId: String, val date: String, val startTime: String, val endTime: String, val remaining: Int)
data class SlotsResponse(val items: List<SlotItem> = emptyList())
data class AppointmentItem(val id: String, val centreName: String? = null, val status: String, val notes: String? = null)
data class AppointmentsResponse(val items: List<AppointmentItem> = emptyList())
data class ReferralResponse(val code: String? = null, val referredCount: Int = 0, val referredBy: String? = null)
data class ApplyReferralRequest(val code: String)
data class KycStatusResponse(val status: String, val rejectionReason: String? = null)
data class KycSubmissionRequest(val documentType: String, val documentNumber: String? = null, val blobUrl: String? = null)
data class PayRequest(val method: String)
data class PlanChangeRequest(val rentalPlanId: String)
data class BreakdownRequest(val issueType: String, val description: String, val lat: Double? = null, val lng: Double? = null)
data class ServiceRequestBody(val category: String, val description: String)
data class ScheduleRequest(val centreId: String, val slotId: String, val notes: String? = null)
data class CancelRequest(val reason: String)
data class RescheduleRequest(val slotId: String, val notes: String? = null)
data class FeedbackRequest(val rating: Int, val comment: String, val category: String? = "App")
data class CreateTicketRequest(val category: String, val subject: String, val description: String)
data class TicketItem(val id: String, val category: String, val subject: String, val status: String)
data class TicketsResponse(val items: List<TicketItem> = emptyList())
data class UpdateProfileRequest(val fullName: String? = null, val email: String? = null, val address: String? = null)
data class ItemsResponse<T>(val items: List<T> = emptyList())

interface SwitchrideApi {
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthTokens

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthTokens

    @GET("rider/home")
    suspend fun home(): HomeResponse

    @GET("rider/vehicle")
    suspend fun vehicle(): VehicleResponse

    @POST("rider/breakdowns")
    suspend fun reportBreakdown(@Body body: BreakdownRequest): BreakdownItem

    @POST("rider/service-requests")
    suspend fun raiseService(@Body body: ServiceRequestBody): ServiceItem

    @GET("rider/service-requests")
    suspend fun serviceRequests(): ItemsResponse<ServiceItem>

    @GET("rider/service-centres")
    suspend fun centres(): CentresResponse

    @GET("rider/slots")
    suspend fun slots(@Query("centreId") centreId: String? = null): SlotsResponse

    @GET("rider/appointments")
    suspend fun appointments(): AppointmentsResponse

    @POST("rider/appointments")
    suspend fun schedule(@Body body: ScheduleRequest): AppointmentItem

    @POST("rider/appointments/{id}/cancel")
    suspend fun cancelAppointment(@Path("id") id: String, @Body body: CancelRequest): AppointmentItem

    @POST("rider/appointments/{id}/reschedule")
    suspend fun rescheduleAppointment(@Path("id") id: String, @Body body: RescheduleRequest): AppointmentItem

    @GET("rider/wallet")
    suspend fun wallet(): WalletResponse

    @GET("rider/payments")
    suspend fun payments(): PaymentsResponse

    @POST("rider/payments")
    suspend fun pay(@Body body: PayRequest): Map<String, Any>

    @GET("rider/plans")
    suspend fun plans(): PlansResponse

    @POST("rider/plan")
    suspend fun changePlan(@Body body: PlanChangeRequest): Map<String, Any>

    @GET("rider/agreements")
    suspend fun agreements(): AgreementsResponse

    @GET("rider/stations")
    suspend fun stations(): StationsResponse

    @GET("rider/referral")
    suspend fun referral(): ReferralResponse

    @POST("rider/referral")
    suspend fun applyReferral(@Body body: ApplyReferralRequest): Map<String, Any>

    @GET("rider/kyc")
    suspend fun getKycStatus(): KycStatusResponse

    @POST("rider/kyc")
    suspend fun submitKyc(@Body request: KycSubmissionRequest): Map<String, Any?>

    @POST("rider/feedback")
    suspend fun feedback(@Body body: FeedbackRequest): Map<String, Any>

    @GET("rider/support")
    suspend fun tickets(): TicketsResponse

    @POST("rider/support")
    suspend fun createTicket(@Body body: CreateTicketRequest): Map<String, Any>

    @GET("rider/profile")
    suspend fun getProfile(): CustomerProfile

    @PUT("rider/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): CustomerProfile

    @GET("branding")
    suspend fun branding(): BrandingResponse

    @GET("hubs/nearby")
    suspend fun getNearbyHubs(@Query("lat") lat: Double, @Query("lng") lng: Double, @Query("radiusKm") radiusKm: Double = 25.0): HubsResponse

    @GET("hubs/{hubId}/vehicles")
    suspend fun getHubVehicles(@Path("hubId") hubId: String): VehiclesResponse

    @POST("bookings")
    suspend fun createBooking(@Body request: CreateBookingRequest): Booking

    @POST("rides/{rideId}/start")
    suspend fun startRide(@Path("rideId") rideId: String, @Body body: EmptyBody = EmptyBody()): Ride

    @POST("rides/{rideId}/end")
    suspend fun endRide(@Path("rideId") rideId: String, @Body body: EmptyBody = EmptyBody()): RideEndResult

    @GET("rides/active")
    suspend fun getActiveRide(): Ride?
}

data class GeoPoint(val lat: Double, val lng: Double)
data class RentalHubSummary(val id: String, val name: String, val location: GeoPoint, val distanceKm: Double, val availableVehicles: Int, val status: String)
data class VehicleSummary(val id: String, val registrationNumber: String, val type: String, val wheelClass: String? = null, val status: String, val batteryPercent: Int, val model: String)
data class CreateBookingRequest(val vehicleId: String, val bookingType: String, val promoCode: String? = null)
data class Booking(val id: String, val vehicleId: String, val bookingType: String, val status: String, val estimatedAmount: Double, val rideId: String?)
data class Ride(val id: String, val bookingId: String, val vehicleId: String, val status: String, val startedAt: String?, val endedAt: String?, val durationMinutes: Int? = null)
data class RideEndResult(val ride: Ride, val fare: Double, val paymentId: String?)
data class HubsResponse(val items: List<RentalHubSummary>)
data class VehiclesResponse(val items: List<VehicleSummary>)
data class BrandingResponse(
    val productName: String? = "Fleetel-Switchride",
    val hasOptionalLogo: Boolean = false,
    val optionalLogoUrl: String? = null,
)
data class EmptyBody(val empty: String? = null)
