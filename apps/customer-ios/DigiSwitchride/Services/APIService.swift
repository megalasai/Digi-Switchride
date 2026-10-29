import Foundation

struct RegisterRequest: Codable { let username: String; let password: String; let fullName: String? }
struct LoginRequest: Codable { let username: String; let password: String }
struct AuthTokens: Codable { let accessToken: String; let refreshToken: String; let expiresIn: Int; let isNewUser: Bool }
struct CustomerProfile: Codable {
    let id: String
    let username: String?
    let phone: String?
    let email: String?
    let fullName: String?
    let kycStatus: String
    let address: String?
    let walletBalance: Double?
}
struct RiderPlan: Codable, Identifiable {
    let id: String
    let name: String
    let charges: Double
    let durationDays: Int
    let billingFrequency: String
    let terms: String?
}
struct RiderVehicle: Codable, Identifiable {
    let id: String
    let registrationNumber: String
    let type: String
    let model: String
    let status: String
    let batteryPercent: Int
}
struct Outstanding: Codable { let count: Int; let amount: Double }
struct RiderAlert: Codable, Identifiable { let id: String; let title: String; let body: String; let status: String? }
struct BreakdownItem: Codable, Identifiable { let id: String; let issueType: String; let description: String; let status: String }
struct ServiceItem: Codable, Identifiable { let id: String; let category: String; let description: String; let status: String }
struct HomeResponse: Codable {
    let rider: CustomerProfile
    let plan: RiderPlan?
    let vehicle: RiderVehicle?
    let walletBalance: Double
    let outstanding: Outstanding
    let alerts: [RiderAlert]
    let breakdown: BreakdownItem?
    let service: ServiceItem?
}
struct VehicleResponse: Codable { let vehicle: RiderVehicle?; let breakdowns: [BreakdownItem]; let requests: [ServiceItem] }
struct VehiclesListResponse: Codable { let items: [RiderVehicle] }
struct AssignVehicleRequest: Codable { let vehicleId: String }
struct PaymentItem: Codable, Identifiable { let id: String; let amount: Double; let status: String; let method: String?; let reference: String? }
struct PaymentsResponse: Codable { let items: [PaymentItem] }
struct WalletItem: Codable, Identifiable { let id: String; let type: String; let amount: Double; let note: String? }
struct WalletResponse: Codable { let items: [WalletItem] }
struct PlansResponse: Codable { let currentPlanId: String?; let items: [RiderPlan] }
struct AgreementItem: Codable, Identifiable { let id: String; let type: String; let content: String; let status: String }
struct AgreementsResponse: Codable { let items: [AgreementItem] }
struct StationItem: Codable, Identifiable { let id: String; let name: String; let address: String; let chargerCount: Int; let status: String; let operatingHours: String? }
struct StationsResponse: Codable { let items: [StationItem] }
struct SlotItem: Codable, Identifiable { let id: String; let centreId: String; let date: String; let startTime: String; let remaining: Int }
struct SlotsResponse: Codable { let items: [SlotItem] }
struct AppointmentItem: Codable, Identifiable { let id: String; let centreName: String?; let status: String }
struct AppointmentsResponse: Codable { let items: [AppointmentItem] }
struct ReferralResponse: Codable { let code: String?; let referredCount: Int; let referredBy: String? }
struct TicketItem: Codable, Identifiable { let id: String; let category: String; let subject: String; let status: String }
struct TicketsResponse: Codable { let items: [TicketItem] }
struct PayRequest: Codable { let method: String }
struct BreakdownRequest: Codable { let issueType: String; let description: String }
struct ServiceRequestBody: Codable { let category: String; let description: String }
struct ScheduleRequest: Codable { let centreId: String; let slotId: String }
struct CancelRequest: Codable { let reason: String }
struct PlanChangeRequest: Codable { let rentalPlanId: String }
struct FeedbackRequest: Codable { let rating: Int; let comment: String; let category: String }
struct CreateTicketRequest: Codable { let category: String; let subject: String; let description: String }
struct ApplyReferralRequest: Codable { let code: String }
struct EmptyJSON: Codable {}

enum APIError: Error { case invalidURL, requestFailed, unauthorized }

class APIService {
    static let shared = APIService()
    private let baseURL = AppConfig.apiBaseURL
    var accessToken: String?

    private func request<T: Decodable>(_ method: String, _ path: String, body: Encodable? = nil) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(AppConfig.tenantSlug, forHTTPHeaderField: "X-Tenant-Slug")
        if let token = accessToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.requestFailed
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func register(username: String, password: String, fullName: String?) async throws -> AuthTokens {
        try await request("POST", "/auth/register", body: RegisterRequest(username: username, password: password, fullName: fullName))
    }
    func login(username: String, password: String) async throws -> AuthTokens {
        try await request("POST", "/auth/login", body: LoginRequest(username: username, password: password))
    }
    func home() async throws -> HomeResponse { try await request("GET", "/rider/home") }
    func vehicle() async throws -> VehicleResponse { try await request("GET", "/rider/vehicle") }
    func availableVehicles() async throws -> VehiclesListResponse { try await request("GET", "/rider/vehicles/available") }
    func assignVehicle(id: String) async throws -> VehicleResponse {
        try await request("POST", "/rider/vehicle/assign", body: AssignVehicleRequest(vehicleId: id))
    }
    func reportBreakdown(issue: String, description: String) async throws -> BreakdownItem {
        try await request("POST", "/rider/breakdowns", body: BreakdownRequest(issueType: issue, description: description))
    }
    func raiseService(category: String, description: String) async throws -> ServiceItem {
        try await request("POST", "/rider/service-requests", body: ServiceRequestBody(category: category, description: description))
    }
    func slots() async throws -> SlotsResponse { try await request("GET", "/rider/slots") }
    func appointments() async throws -> AppointmentsResponse { try await request("GET", "/rider/appointments") }
    func schedule(centreId: String, slotId: String) async throws -> AppointmentItem {
        try await request("POST", "/rider/appointments", body: ScheduleRequest(centreId: centreId, slotId: slotId))
    }
    func cancelAppointment(id: String) async throws -> AppointmentItem {
        try await request("POST", "/rider/appointments/\(id)/cancel", body: CancelRequest(reason: "Rider cancelled from app"))
    }
    func wallet() async throws -> WalletResponse { try await request("GET", "/rider/wallet") }
    func payments() async throws -> PaymentsResponse { try await request("GET", "/rider/payments") }
    func pay(method: String) async throws -> EmptyJSON { try await request("POST", "/rider/payments", body: PayRequest(method: method)) }
    func plans() async throws -> PlansResponse { try await request("GET", "/rider/plans") }
    func changePlan(id: String) async throws -> EmptyJSON { try await request("POST", "/rider/plan", body: PlanChangeRequest(rentalPlanId: id)) }
    func agreements() async throws -> AgreementsResponse { try await request("GET", "/rider/agreements") }
    func stations() async throws -> StationsResponse { try await request("GET", "/rider/stations") }
    func referral() async throws -> ReferralResponse { try await request("GET", "/rider/referral") }
    func applyReferral(code: String) async throws -> EmptyJSON { try await request("POST", "/rider/referral", body: ApplyReferralRequest(code: code)) }
    func tickets() async throws -> TicketsResponse { try await request("GET", "/rider/support") }
    func createTicket(category: String, subject: String, description: String) async throws -> EmptyJSON {
        try await request("POST", "/rider/support", body: CreateTicketRequest(category: category, subject: subject, description: description))
    }
    func feedback(rating: Int, comment: String, category: String) async throws -> EmptyJSON {
        try await request("POST", "/rider/feedback", body: FeedbackRequest(rating: rating, comment: comment, category: category))
    }
    func getProfile() async throws -> CustomerProfile { try await request("GET", "/rider/profile") }
}

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

    func login(username: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let tokens = try await APIService.shared.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            APIService.shared.accessToken = tokens.accessToken
            KeychainHelper.save(key: "refresh_token", value: tokens.refreshToken)
            isAuthenticated = true
        } catch {
            self.error = "Unable to reach server or invalid credentials. Check API is running on port 4000."
        }
        isLoading = false
    }

    func register(username: String, password: String, fullName: String?) async {
        isLoading = true
        error = nil
        do {
            let tokens = try await APIService.shared.register(
                username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                fullName: fullName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true ? nil : fullName
            )
            APIService.shared.accessToken = tokens.accessToken
            KeychainHelper.save(key: "refresh_token", value: tokens.refreshToken)
            isAuthenticated = true
        } catch {
            self.error = "Unable to reach server or username already taken. Check API is running on port 4000."
        }
        isLoading = false
    }

    func logout() {
        APIService.shared.accessToken = nil
        KeychainHelper.delete(key: "refresh_token")
        isAuthenticated = false
    }
}

enum KeychainHelper {
    static func save(key: String, value: String) { UserDefaults.standard.set(value, forKey: key) }
    static func load(key: String) -> String? { UserDefaults.standard.string(forKey: key) }
    static func delete(key: String) { UserDefaults.standard.removeObject(forKey: key) }
}
