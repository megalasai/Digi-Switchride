package com.digiswitchride.customer.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.digiswitchride.customer.BuildConfig
import com.digiswitchride.customer.data.ApiErrorParser
import com.digiswitchride.customer.data.ApiSettings
import com.digiswitchride.customer.data.TokenManager
import com.digiswitchride.customer.data.api.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val error: String? = null,
    val productName: String = "Fleetel Switchride",
    val optionalLogoUrl: String? = null,
    val organizations: List<PublicTenantOption> = emptyList(),
    val organizationsLoading: Boolean = true,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: SwitchrideApi,
    private val tokenManager: TokenManager,
    private val apiSettings: ApiSettings,
) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state
    private val _tenantSlug = MutableStateFlow(BuildConfig.DEFAULT_TENANT_SLUG)
    val tenantSlug: StateFlow<String> = _tenantSlug
    private val _sessionChecked = MutableStateFlow(false)
    val sessionChecked: StateFlow<Boolean> = _sessionChecked
    private val _hasSession = MutableStateFlow(false)
    val hasSession: StateFlow<Boolean> = _hasSession

    init {
        viewModelScope.launch {
            _tenantSlug.value = apiSettings.getTenantSlug()
            _hasSession.value = tokenManager.getAccessToken() != null
            _sessionChecked.value = true
            try {
                val branding = api.branding()
                val slug = _tenantSlug.value
                val orgs = try {
                    api.publicTenants().items
                } catch (_: Exception) {
                    emptyList()
                }
                if (orgs.isNotEmpty() && orgs.none { it.slug == slug }) {
                    val pick = orgs.find { it.isDefault }?.slug ?: orgs.first().slug
                    _tenantSlug.value = pick
                    apiSettings.setTenantSlug(pick)
                }
                _state.value = _state.value.copy(
                    productName = branding.productName?.replace("-", " ") ?: "Fleetel Switchride",
                    optionalLogoUrl = if (branding.hasOptionalLogo) apiSettings.brandingLogoUrl(_tenantSlug.value) else null,
                    organizations = orgs,
                    organizationsLoading = false,
                )
            } catch (_: Exception) {
                _state.value = _state.value.copy(organizationsLoading = false)
            }
        }
    }

    fun updateTenantSlug(slug: String) {
        _tenantSlug.value = slug
        viewModelScope.launch {
            apiSettings.setTenantSlug(slug)
            try {
                val branding = api.branding()
                _state.value = _state.value.copy(
                    productName = branding.productName?.replace("-", " ") ?: "Fleetel Switchride",
                    optionalLogoUrl = if (branding.hasOptionalLogo) apiSettings.brandingLogoUrl(slug) else null,
                )
            } catch (_: Exception) { }
        }
    }
    fun clearError() { _state.value = _state.value.copy(error = null) }
    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                apiSettings.setTenantSlug(_tenantSlug.value)
                val slug = _tenantSlug.value.trim().lowercase()
                val tokens = api.login(LoginRequest(username.trim(), password, slug))
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
                apiSettings.setTenantSlug(_tenantSlug.value)
                val slug = _tenantSlug.value.trim().lowercase()
                val tokens = api.register(
                    RegisterRequest(
                        username.trim(),
                        password,
                        fullName?.trim()?.takeIf { it.isNotEmpty() },
                        slug,
                    ),
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
            _state.value = AuthState(
                productName = _state.value.productName,
                optionalLogoUrl = _state.value.optionalLogoUrl,
            )
            onLoggedOut()
        }
    }

    private fun friendlyNetworkError(e: Exception): String {
        val message = e.message.orEmpty()
        return when {
            message.contains("Failed to connect", ignoreCase = true) ||
                message.contains("timeout", ignoreCase = true) ||
                message.contains("Unable to resolve host", ignoreCase = true) ->
                "Cannot reach Digi-Switchride. Check mobile data or Wi‑Fi, then try again."
            else -> ApiErrorParser.message(e)
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

data class RiderUiState(
    val loading: Boolean = false,
    val home: HomeResponse? = null,
    val vehicle: VehicleResponse? = null,
    val availableVehicles: List<VehicleSummary> = emptyList(),
    val payments: List<PaymentItem> = emptyList(),
    val wallet: List<WalletItem> = emptyList(),
    val plans: PlansResponse? = null,
    val agreements: List<AgreementItem> = emptyList(),
    val stations: List<StationItem> = emptyList(),
    val centres: List<CentreItem> = emptyList(),
    val slots: List<SlotItem> = emptyList(),
    val appointments: List<AppointmentItem> = emptyList(),
    val tickets: List<TicketItem> = emptyList(),
    val referral: ReferralResponse? = null,
    val message: String? = null,
    val error: String? = null,
    val tenantLogoUrl: String? = null,
)

@HiltViewModel
class RiderAppViewModel @Inject constructor(
    private val api: SwitchrideApi,
    private val apiSettings: ApiSettings,
) : ViewModel() {
    private val _state = MutableStateFlow(RiderUiState())
    val state: StateFlow<RiderUiState> = _state
    init {
        viewModelScope.launch {
            runCatching {
                val branding = api.branding()
                val slug = apiSettings.getTenantSlug()
                val logo = if (branding.hasOptionalLogo) apiSettings.brandingLogoUrl(slug) else null
                _state.value = _state.value.copy(tenantLogoUrl = logo)
            }
        }
    }
    fun clearMessage() { _state.value = _state.value.copy(message = null, error = null) }
    fun refreshHome() = launch { _state.value = _state.value.copy(home = api.home()) }
    fun refreshVehicle() = refreshService()
    fun refreshPay() = launch {
        _state.value = _state.value.copy(payments = api.payments().items, wallet = api.wallet().items, home = api.home())
    }
    fun refreshPlans() = launch { _state.value = _state.value.copy(plans = api.plans()) }
    fun refreshDocs() = launch { _state.value = _state.value.copy(agreements = api.agreements().items) }
    fun refreshStations() = launch { _state.value = _state.value.copy(stations = api.stations().items) }
    fun refreshService() = launch {
        val assigned = api.vehicle()
        val available = if (assigned.vehicle == null) api.availableVehicles().items else emptyList()
        _state.value = _state.value.copy(
            centres = api.centres().items,
            slots = api.slots().items,
            appointments = api.appointments().items,
            vehicle = assigned,
            availableVehicles = available,
        )
    }
    fun assignVehicle(vehicleId: String) = launch {
        api.assignVehicle(AssignVehicleRequest(vehicleId))
        _state.value = _state.value.copy(message = "Vehicle assigned to you")
        refreshService(); refreshHome()
    }
    fun refreshSupport() = launch { _state.value = _state.value.copy(tickets = api.tickets().items) }
    fun refreshReferral() = launch { _state.value = _state.value.copy(referral = api.referral()) }
    fun applyReferral(code: String) = launch {
        api.applyReferral(ApplyReferralRequest(code))
        _state.value = _state.value.copy(message = "Referral applied")
        refreshReferral()
    }
    fun pay(method: String) = launch {
        api.pay(PayRequest(method))
        _state.value = _state.value.copy(message = "Payment recorded ($method)")
        refreshPay()
    }
    fun reportBreakdown(issue: String, description: String) = launch {
        api.reportBreakdown(BreakdownRequest(issue, description))
        _state.value = _state.value.copy(message = "Breakdown sent to Command Center")
        refreshVehicle(); refreshHome()
    }
    fun raiseService(category: String, description: String) = launch {
        api.raiseService(ServiceRequestBody(category, description))
        _state.value = _state.value.copy(message = "Service request raised")
        refreshService()
    }
    fun schedule(centreId: String, slotId: String) = launch {
        api.schedule(ScheduleRequest(centreId, slotId))
        _state.value = _state.value.copy(message = "Appointment scheduled")
        refreshService()
    }
    fun cancelAppt(id: String, reason: String) = launch {
        api.cancelAppointment(id, CancelRequest(reason))
        _state.value = _state.value.copy(message = "Appointment cancelled")
        refreshService()
    }
    fun reschedule(id: String, slotId: String) = launch {
        api.rescheduleAppointment(id, RescheduleRequest(slotId))
        _state.value = _state.value.copy(message = "Appointment rescheduled")
        refreshService()
    }
    fun changePlan(id: String) = launch {
        api.changePlan(PlanChangeRequest(id))
        _state.value = _state.value.copy(message = "Plan updated")
        refreshPlans(); refreshHome()
    }
    fun sendFeedback(rating: Int, comment: String, category: String) = launch {
        api.feedback(FeedbackRequest(rating, comment, category))
        _state.value = _state.value.copy(message = "Thanks for your feedback")
    }
    fun createTicket(subject: String, description: String) = launch {
        api.createTicket(CreateTicketRequest("General", subject, description))
        _state.value = _state.value.copy(message = "Support ticket created")
        refreshSupport()
    }
    fun saveProfile(name: String, email: String, address: String) = launch {
        api.updateProfile(UpdateProfileRequest(name, email, address))
        _state.value = _state.value.copy(message = "Profile saved", home = api.home())
    }
    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                block()
                _state.value = _state.value.copy(loading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}

data class BookRideState(
    val isLoading: Boolean = false,
    val hubs: List<RentalHubSummary> = emptyList(),
    val selectedHubId: String? = null,
    val vehicles: List<VehicleSummary> = emptyList(),
    val kycStatus: String = "NotSubmitted",
    val error: String? = null,
    val message: String? = null,
)

@HiltViewModel
class BookRideViewModel @Inject constructor(private val api: SwitchrideApi) : ViewModel() {
    private val _state = MutableStateFlow(BookRideState())
    val state: StateFlow<BookRideState> = _state

    fun clearMessage() { _state.value = _state.value.copy(error = null, message = null) }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val hubs = api.getNearbyHubs(21.1458, 79.0882).items
                val kyc = api.getKycStatus().status
                _state.value = _state.value.copy(isLoading = false, hubs = hubs, kycStatus = kyc)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }

    fun selectHub(hubId: String) {
        _state.value = _state.value.copy(selectedHubId = hubId, vehicles = emptyList())
        viewModelScope.launch {
            try {
                val vehicles = api.getHubVehicles(hubId).items.filter { it.status == "Available" }
                _state.value = _state.value.copy(vehicles = vehicles)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = ApiErrorParser.message(e))
            }
        }
    }

    fun bookAndStart(vehicleId: String, onStarted: (String) -> Unit) {
        if (_state.value.kycStatus != "Approved") {
            _state.value = _state.value.copy(error = "KYC must be approved before booking.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val booking = api.createBooking(CreateBookingRequest(vehicleId, "PerMinute"))
                val rideId = booking.rideId ?: error("No ride ID")
                api.startRide(rideId)
                _state.value = _state.value.copy(isLoading = false, message = "Ride started")
                onStarted(rideId)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
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
                _state.value = _state.value.copy(isLoading = false, fare = result.fare, paymentId = result.paymentId, ended = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = ApiErrorParser.message(e))
            }
        }
    }
}
