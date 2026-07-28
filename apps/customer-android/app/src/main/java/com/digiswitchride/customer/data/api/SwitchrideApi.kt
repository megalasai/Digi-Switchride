package com.digiswitchride.customer.data.api

import com.digiswitchride.customer.BuildConfig
import retrofit2.http.*

data class SendOtpRequest(val phone: String)
data class SendOtpResponse(val message: String, val expiresInSeconds: Int)
data class VerifyOtpRequest(val phone: String, val otp: String)
data class AuthTokens(val accessToken: String, val refreshToken: String, val expiresIn: Int, val isNewUser: Boolean)
data class GeoPoint(val lat: Double, val lng: Double)
data class RentalHubSummary(val id: String, val name: String, val location: GeoPoint, val distanceKm: Double, val availableVehicles: Int, val status: String)
data class VehicleSummary(val id: String, val registrationNumber: String, val type: String, val status: String, val batteryPercent: Int, val model: String)
data class CreateBookingRequest(val vehicleId: String, val bookingType: String, val promoCode: String? = null)
data class Booking(val id: String, val vehicleId: String, val bookingType: String, val status: String, val estimatedAmount: Double, val rideId: String?)
data class Ride(val id: String, val bookingId: String, val vehicleId: String, val status: String, val startedAt: String?, val endedAt: String?)
data class RideEndResult(val ride: Ride, val fare: Double, val paymentId: String?)
data class KycStatus(val status: String)
data class CustomerProfile(val id: String, val phone: String, val fullName: String?, val kycStatus: String)
data class CreateTicketRequest(val category: String, val subject: String, val description: String)
data class HubsResponse(val items: List<RentalHubSummary>)
data class VehiclesResponse(val items: List<VehicleSummary>)

interface SwitchrideApi {
    @POST("auth/otp/send")
    suspend fun sendOtp(@Body request: SendOtpRequest): SendOtpResponse

    @POST("auth/otp/verify")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): AuthTokens

    @GET("me")
    suspend fun getProfile(): CustomerProfile

    @GET("kyc/status")
    suspend fun getKycStatus(): KycStatus

    @GET("hubs/nearby")
    suspend fun getNearbyHubs(@Query("lat") lat: Double, @Query("lng") lng: Double, @Query("radiusKm") radiusKm: Double = 5.0): HubsResponse

    @GET("hubs/{hubId}/vehicles")
    suspend fun getHubVehicles(@Path("hubId") hubId: String): VehiclesResponse

    @POST("bookings")
    suspend fun createBooking(@Body request: CreateBookingRequest): Booking

    @POST("rides/{rideId}/start")
    suspend fun startRide(@Path("rideId") rideId: String): Ride

    @POST("rides/{rideId}/end")
    suspend fun endRide(@Path("rideId") rideId: String): RideEndResult

    @GET("rides/active")
    suspend fun getActiveRide(): Ride?

    @GET("rides/history")
    suspend fun getRideHistory(): Map<String, List<Ride>>

    @POST("support/tickets")
    suspend fun createTicket(@Body request: CreateTicketRequest): Map<String, String>
}
