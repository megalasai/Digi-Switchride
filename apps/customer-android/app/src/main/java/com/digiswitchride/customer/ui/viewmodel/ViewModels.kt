package com.digiswitchride.customer.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.digiswitchride.customer.data.TokenManager
import com.digiswitchride.customer.data.api.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthState(val isLoading: Boolean = false, val isAuthenticated: Boolean = false, val error: String? = null)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: SwitchrideApi,
    private val tokenManager: TokenManager
) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state

    fun sendOtp(phone: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                api.sendOtp(SendOtpRequest(phone))
                _state.value = _state.value.copy(isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun verifyOtp(phone: String, otp: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val tokens = api.verifyOtp(VerifyOtpRequest(phone, otp))
                tokenManager.saveTokens(tokens.accessToken, tokens.refreshToken)
                _state.value = _state.value.copy(isLoading = false, isAuthenticated = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}

data class HomeState(
    val isLoading: Boolean = false,
    val hubs: List<RentalHubSummary> = emptyList(),
    val selectedHubVehicles: List<VehicleSummary> = emptyList(),
    val kycStatus: String = "NotSubmitted",
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    fun loadNearbyHubs(lat: Double, lng: Double) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                val hubs = api.getNearbyHubs(lat, lng).items
                val kyc = api.getKycStatus().status
                _state.value = _state.value.copy(isLoading = false, hubs = hubs, kycStatus = kyc)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectHub(hubId: String) {
        viewModelScope.launch {
            try {
                val vehicles = api.getHubVehicles(hubId).items
                _state.value = _state.value.copy(selectedHubVehicles = vehicles)
            } catch (_: Exception) {}
        }
    }

    fun bookVehicle(vehicleId: String, onBooked: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val booking = api.createBooking(CreateBookingRequest(vehicleId, "PerMinute"))
                booking.rideId?.let { onBooked(it) }
            } catch (_: Exception) {}
        }
    }

    fun startRide(rideId: String, onStarted: () -> Unit) {
        viewModelScope.launch {
            try {
                api.startRide(rideId)
                onStarted()
            } catch (_: Exception) {}
        }
    }
}
