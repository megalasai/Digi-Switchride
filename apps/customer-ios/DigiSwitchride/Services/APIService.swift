import Foundation

struct SendOtpRequest: Codable { let phone: String }
struct SendOtpResponse: Codable { let message: String; let expiresInSeconds: Int }
struct VerifyOtpRequest: Codable { let phone: String; let otp: String }
struct AuthTokens: Codable { let accessToken: String; let refreshToken: String; let expiresIn: Int; let isNewUser: Bool }
struct GeoPoint: Codable { let lat: Double; let lng: Double }
struct RentalHubSummary: Codable, Identifiable { let id: String; let name: String; let location: GeoPoint; let distanceKm: Double; let availableVehicles: Int; let status: String }
struct VehicleSummary: Codable, Identifiable { let id: String; let registrationNumber: String; let type: String; let status: String; let batteryPercent: Int; let model: String }
struct CreateBookingRequest: Codable { let vehicleId: String; let bookingType: String; let promoCode: String? }
struct Booking: Codable { let id: String; let vehicleId: String; let bookingType: String; let status: String; let estimatedAmount: Double; let rideId: String? }
struct Ride: Codable, Identifiable { let id: String; let bookingId: String; let vehicleId: String; let status: String; let startedAt: String?; let endedAt: String? }
struct RideEndResult: Codable { let ride: Ride; let fare: Double; let paymentId: String? }
struct KycStatus: Codable { let status: String }
struct CustomerProfile: Codable { let id: String; let phone: String; let fullName: String?; let kycStatus: String }
struct HubsResponse: Codable { let items: [RentalHubSummary] }
struct VehiclesResponse: Codable { let items: [VehicleSummary] }
struct CreateTicketRequest: Codable { let category: String; let subject: String; let description: String }

enum APIError: Error { case invalidURL, requestFailed, unauthorized }

class APIService {
    static let shared = APIService()
    private let baseURL = "http://localhost:4000/api"
    var accessToken: String?

    private func request<T: Decodable>(_ method: String, _ path: String, body: Encodable? = nil) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = accessToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body = body { req.httpBody = try JSONEncoder().encode(body) }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.requestFailed
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func sendOtp(phone: String) async throws -> SendOtpResponse {
        try await request("POST", "/auth/otp/send", body: SendOtpRequest(phone: phone))
    }

    func verifyOtp(phone: String, otp: String) async throws -> AuthTokens {
        try await request("POST", "/auth/otp/verify", body: VerifyOtpRequest(phone: phone, otp: otp))
    }

    func getNearbyHubs(lat: Double, lng: Double) async throws -> HubsResponse {
        try await request("GET", "/hubs/nearby?lat=\(lat)&lng=\(lng)&radiusKm=5")
    }

    func getHubVehicles(hubId: String) async throws -> VehiclesResponse {
        try await request("GET", "/hubs/\(hubId)/vehicles")
    }

    func createBooking(vehicleId: String) async throws -> Booking {
        try await request("POST", "/bookings", body: CreateBookingRequest(vehicleId: vehicleId, bookingType: "PerMinute", promoCode: nil))
    }

    func startRide(rideId: String) async throws -> Ride {
        try await request("POST", "/rides/\(rideId)/start")
    }

    func endRide(rideId: String) async throws -> RideEndResult {
        try await request("POST", "/rides/\(rideId)/end")
    }

    func getKycStatus() async throws -> KycStatus {
        try await request("GET", "/kyc/status")
    }

    func getProfile() async throws -> CustomerProfile {
        try await request("GET", "/me")
    }

    func createTicket(category: String, subject: String, description: String) async throws {
        let _: [String: String] = try await request("POST", "/support/tickets", body: CreateTicketRequest(category: category, subject: subject, description: description))
    }
}

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

    func sendOtp(phone: String) async {
        isLoading = true
        error = nil
        do {
            _ = try await APIService.shared.sendOtp(phone: phone)
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func verifyOtp(phone: String, otp: String) async {
        isLoading = true
        error = nil
        do {
            let tokens = try await APIService.shared.verifyOtp(phone: phone, otp: otp)
            APIService.shared.accessToken = tokens.accessToken
            KeychainHelper.save(key: "refresh_token", value: tokens.refreshToken)
            isAuthenticated = true
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func logout() {
        APIService.shared.accessToken = nil
        KeychainHelper.delete(key: "refresh_token")
        isAuthenticated = false
    }
}

enum KeychainHelper {
    static func save(key: String, value: String) {
        UserDefaults.standard.set(value, forKey: key)
    }
    static func load(key: String) -> String? {
        UserDefaults.standard.string(forKey: key)
    }
    static func delete(key: String) {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
