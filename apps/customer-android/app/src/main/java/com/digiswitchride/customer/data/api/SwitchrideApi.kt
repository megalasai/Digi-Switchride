package com.digiswitchride.customer.data.api

import retrofit2.http.*

data class RegisterRequest(val username: String, val password: String, val fullName: String? = null)
data class LoginRequest(val username: String, val password: String)
data class AuthTokens(val accessToken: String, val refreshToken: String, val expiresIn: Int, val isNewUser: Boolean)
data class GeoPoint(val lat: Double, val lng: Double)
data class RentalHubSummary(val id: String, val name: String, val location: GeoPoint, val distanceKm: Double, val availableVehicles: Int, val status: String)
data class VehicleSummary(val id: String, val registrationNumber: String, val type: String, val status: String, val batteryPercent: Int, val model: String)
data class CreateBookingRequest(val vehicleId: String, val bookingType: String, val promoCode: String? = null)
data class Booking(val id: String, val vehicleId: String, val bookingType: String, val status: String, val estimatedAmount: Double, val rideId: String?)
data class Ride(val id: String, val bookingId: String, val vehicleId: String, val status: String, val startedAt: String?, val endedAt: String?, val durationMinutes: Int? = null)
data class RideEndResult(val ride: Ride, val fare: Double, val paymentId: String?)
data class RideHistoryResponse(val items: List<Ride>, val page: Int, val pageSize: Int, val totalCount: Int)
data class KycStatusResponse(val status: String, val rejectionReason: String? = null)
data class KycSubmissionRequest(val documentType: String, val documentNumber: String? = null, val blobUrl: String? = null)
data class CustomerProfile(val id: String, val username: String?, val phone: String?, val fullName: String?, val kycStatus: String)
data class CreateTicketRequest(val category: String, val subject: String, val description: String)
data class HubsResponse(val items: List<RentalHubSummary>)
data class VehiclesResponse(val items: List<VehicleSummary>)
data class EmptyBody(val empty: String? = null)

interface SwitchrideApi {
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthTokens

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthTokens

    @GET("me")
    suspend fun getProfile(): CustomerProfile

    @GET("kyc/status")
    suspend fun getKycStatus(): KycStatusResponse

    @POST("kyc/submissions")
    suspend fun submitKyc(@Body request: KycSubmissionRequest): Map<String, Any?>

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

    @GET("rides/history")
    suspend fun getRideHistory(@Query("page") page: Int = 1, @Query("pageSize") pageSize: Int = 20): RideHistoryResponse

    @POST("support/tickets")
    suspend fun createTicket(@Body request: CreateTicketRequest): Map<String, String>
}
