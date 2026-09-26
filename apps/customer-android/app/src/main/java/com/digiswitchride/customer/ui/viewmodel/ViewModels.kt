package com.digiswitchride.customer.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.digiswitchride.customer.data.ApiErrorParser
import com.digiswitchride.customer.data.ApiSettings
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
    private val tokenManager: TokenManager,
    private val apiSettings: ApiSettings,
) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state

    private val _apiHost = MutableStateFlow("")
    val apiHost: StateFlow<String> = _apiHost

    private val _sessionChecked = MutableStateFlow(false)
    val sessionChecked: StateFlow<Boolean> = _sessionChecked

    private val _hasSession = MutableStateFlow(false)
    val hasSession: StateFlow<Boolean> = _hasSession

    init {
        viewModelScope.launch {
            _apiHost.value = apiSettings.getDisplayHost()
            _hasSession.value = tokenManager.getAccessToken() != null
            _sessionChecked.value = true
        }
    }

    fun updateApiHost(host: String) { _apiHost.value = host }
    fun clearError() { _state.value = _state.value.copy(error = null) }

    private suspend fun persistApiHost() {
        if (_apiHost.value.isNotBlank()) apiSettings.setBaseUrl(_apiHost.value)
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                persistApiHost()
                val tokens = api.login(LoginRequest(username.trim(), password))
                tokenManager.saveTokens(tokens.accessToken, tokens.refreshToken)
                _hasSession.value = true
                _state.value = _state.value.copy(isLoading = false, isAuthenticated = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = friendlyNetworkError(e))
            }
        }
    }

    fun register(username: String, password: String, fullName: String?) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                persistApiHost()
                val tokens = api.register(
                    RegisterRequest(username.trim(), password, fullName?.trim()?.takeIf { it.isNotEmpty() })
                )
                tokenManager.saveTokens(tokens.accessToken, tokens.refreshToken)
                _hasSession.value = true
                _state.value = _state.value.copy(isLoading = false, isAuthenticated = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = friendlyNetworkError(e))
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            tokenManager.clear()
            _hasSession.value = false
            _state.value = AuthState()
            onLoggedOut()
        }
    }

    private fun friendlyNetworkError(e: Exception): String {
        val message = e.message.orEmpty()
        return when {
            message.contains("Failed to connect", ignoreCase = true) ||
                message.contains("timeout", ignoreCase = true) ||
                message.contains("Unable to resolve host", ignoreCase = true) ->
                "Cannot reach API server. On a phone use your PC IP (ipconfig), e.g. 192.168.0.50:4000"
            else -> ApiErrorParser.message(e)
        }
    }
}

data class HomeState(
    val isLoading: Boolean = false,
    val hubs: List<RentalHubSummary> = emptyList(),
    val selectedHubId: String? = null,
    val selectedHubVehicles: List<VehicleSummary> = emptyList(),
    val kycStatus: String = "NotSubmitted",
    val message: String? = null,
    val error: String? = null,
)

@HiltViewModel
class HomeViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    fun clearMessage() { _state.value = _state.value.copy(message = null, error = null) }

    fun loadNearbyHubs(lat: Double = 21.1458, lng: Double = 79.0882) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val hubs = api.getNearbyHubs(lat, lng).items
                val kyc = api.getKycStatus().status
                _state.value = _state.value.copy(isLoading = false, hubs = hubs, kycStatus = kyc)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }

    fun selectHub(hubId: String) {
        _state.value = _state.value.copy(selectedHubId = hubId, selectedHubVehicles = emptyList(), error = null)
        viewModelScope.launch {
            try {
                val vehicles = api.getHubVehicles(hubId).items.filter { it.status == "Available" }
                _state.value = _state.value.copy(selectedHubVehicles = vehicles)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = ApiErrorParser.message(e))
            }
        }
    }

    fun bookAndStartRide(vehicleId: String, onStarted: (rideId: String) -> Unit) {
        if (_state.value.kycStatus != "Approved") {
            _state.value = _state.value.copy(error = "Complete KYC and wait for admin approval before booking.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, message = null)
            try {
                val booking = api.createBooking(CreateBookingRequest(vehicleId, "PerMinute"))
                val rideId = booking.rideId ?: throw IllegalStateException("Booking created but no ride ID returned")
                api.startRide(rideId)
                _state.value = _state.value.copy(isLoading = false, message = "Ride started!")
                onStarted(rideId)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }

    fun checkActiveRide(onActive: (String) -> Unit) {
        viewModelScope.launch {
            try {
                api.getActiveRide()?.let { if (it.status == "InProgress") onActive(it.id) }
            } catch (_: Exception) {}
        }
    }

    fun refreshKyc() {
        viewModelScope.launch {
            try {
                val kyc = api.getKycStatus().status
                _state.value = _state.value.copy(kycStatus = kyc)
            } catch (_: Exception) {}
        }
    }
}

data class ProfileState(val profile: CustomerProfile? = null, val isLoading: Boolean = false, val error: String? = null)

@HiltViewModel
class ProfileViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(ProfileState())
    val state: StateFlow<ProfileState> = _state

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                _state.value = _state.value.copy(isLoading = false, profile = api.getProfile())
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}

data class KycState(val isLoading: Boolean = false, val uploaded: Set<String> = emptySet(), val error: String? = null, val submitted: Boolean = false)

@HiltViewModel
class KycViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(KycState())
    val state: StateFlow<KycState> = _state

    fun markUploaded(documentType: String) {
        _state.value = _state.value.copy(uploaded = _state.value.uploaded + documentType, error = null)
    }

    fun submitAll(onComplete: () -> Unit) {
        val required = listOf("Aadhaar", "PAN", "DrivingLicence", "Selfie")
        val missing = required.filter { it !in _state.value.uploaded }
        if (missing.isNotEmpty()) {
            _state.value = _state.value.copy(error = "Mark all documents as uploaded first (tap each row).")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                required.forEach { type ->
                    api.submitKyc(KycSubmissionRequest(documentType = type, documentNumber = "MOBILE-DEV-$type"))
                }
                _state.value = _state.value.copy(isLoading = false, submitted = true)
                onComplete()
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}

data class RideHistoryState(val rides: List<Ride> = emptyList(), val isLoading: Boolean = false, val error: String? = null)

@HiltViewModel
class RideHistoryViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(RideHistoryState())
    val state: StateFlow<RideHistoryState> = _state

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val rides = api.getRideHistory().items
                _state.value = _state.value.copy(isLoading = false, rides = rides)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}

data class SupportState(val isLoading: Boolean = false, val error: String? = null, val success: Boolean = false)

@HiltViewModel
class SupportViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(SupportState())
    val state: StateFlow<SupportState> = _state

    fun submit(subject: String, description: String) {
        if (subject.isBlank() || description.isBlank()) {
            _state.value = _state.value.copy(error = "Subject and description are required.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, success = false)
            try {
                api.createTicket(CreateTicketRequest("General", subject.trim(), description.trim()))
                _state.value = _state.value.copy(isLoading = false, success = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }

    fun clearSuccess() { _state.value = _state.value.copy(success = false) }
}

data class ActiveRideState(
    val isLoading: Boolean = false,
    val fare: Double? = null,
    val paymentId: String? = null,
    val error: String? = null,
    val ended: Boolean = false,
)

@HiltViewModel
class ActiveRideViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(ActiveRideState())
    val state: StateFlow<ActiveRideState> = _state

    fun endRide(rideId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val result = api.endRide(rideId)
                _state.value = _state.value.copy(
                    isLoading = false,
                    fare = result.fare,
                    paymentId = result.paymentId,
                    ended = true,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}
