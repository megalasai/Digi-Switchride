import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var phone = ""
    @State private var otp = ""
    @State private var otpSent = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("Digi-Switchride")
                .font(.largeTitle.bold())
                .foregroundStyle(.green)
            Text("Electric rides at your fingertips")
                .foregroundStyle(.secondary)

            TextField("Phone (+91...)", text: $phone)
                .keyboardType(.phonePad)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)

            if otpSent {
                TextField("OTP", text: $otp)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal)
            }

            Button {
                Task {
                    if otpSent {
                        await auth.verifyOtp(phone: phone, otp: otp)
                    } else {
                        await auth.sendOtp(phone: phone)
                        otpSent = true
                    }
                }
            } label: {
                if auth.isLoading {
                    ProgressView()
                } else {
                    Text(otpSent ? "Verify OTP" : "Send OTP")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .padding(.horizontal)
            .disabled(auth.isLoading)

            if let error = auth.error {
                Text(error).foregroundStyle(.red).font(.caption)
            }
            Spacer()
        }
    }
}

struct HomeView: View {
    @State private var hubs: [RentalHubSummary] = []
    @State private var vehicles: [VehicleSummary] = []
    @State private var selectedHubId: String?
    @State private var activeRide: Ride?
    @State private var showActiveRide = false

    var body: some View {
        NavigationStack {
            List {
                Section("Nearby Hubs") {
                    ForEach(hubs) { hub in
                        Button {
                            selectedHubId = hub.id
                            Task { vehicles = (try? await APIService.shared.getHubVehicles(hubId: hub.id).items) ?? [] }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(hub.name).font(.headline)
                                Text("\(hub.availableVehicles) vehicles • \(String(format: "%.1f", hub.distanceKm)) km")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if !vehicles.isEmpty {
                    Section("Available Vehicles") {
                        ForEach(vehicles) { vehicle in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(vehicle.model).font(.headline)
                                    Text("\(vehicle.registrationNumber) • \(vehicle.batteryPercent)%")
                                        .font(.caption)
                                }
                                Spacer()
                                Button("Book") {
                                    Task {
                                        if let booking = try? await APIService.shared.createBooking(vehicleId: vehicle.id),
                                           let rideId = booking.rideId {
                                            _ = try? await APIService.shared.startRide(rideId: rideId)
                                            showActiveRide = true
                                        }
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.green)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Nearby Hubs")
            .task { hubs = (try? await APIService.shared.getNearbyHubs(lat: 21.1458, lng: 79.0882).items) ?? [] }
            .sheet(isPresented: $showActiveRide) { ActiveRideView() }
        }
    }
}

struct ActiveRideView: View {
    @Environment(\.dismiss) var dismiss
    @State private var elapsed = 0
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 32) {
            Text("Ride In Progress").font(.title.bold()).foregroundStyle(.green)
            Text(String(format: "%02d:%02d", elapsed / 60, elapsed % 60))
                .font(.system(size: 48, weight: .bold, design: .monospaced))
            Button("End Ride") { dismiss() }
                .buttonStyle(.borderedProminent)
                .tint(.red)
        }
        .padding()
        .onReceive(timer) { _ in elapsed += 1 }
    }
}

struct RideHistoryView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView("No Rides Yet", systemImage: "clock", description: Text("Your ride history will appear here."))
                .navigationTitle("History")
        }
    }
}

struct SupportView: View {
    @State private var subject = ""
    @State private var description = ""
    @State private var submitted = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Subject", text: $subject)
                TextField("Description", text: $description, axis: .vertical).lineLimit(4...8)
                Button("Submit Ticket") {
                    Task {
                        try? await APIService.shared.createTicket(category: "General", subject: subject, description: description)
                        submitted = true
                    }
                }
            }
            .navigationTitle("Support")
            .alert("Ticket Submitted", isPresented: $submitted) { Button("OK") {} }
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var profile: CustomerProfile?

    var body: some View {
        NavigationStack {
            List {
                if let p = profile {
                    LabeledContent("Phone", value: p.phone)
                    LabeledContent("Name", value: p.fullName ?? "—")
                    LabeledContent("KYC", value: p.kycStatus)
                }
                NavigationLink("Complete KYC") { KycView() }
                Button("Logout", role: .destructive) { auth.logout() }
            }
            .navigationTitle("Profile")
            .task { profile = try? await APIService.shared.getProfile() }
        }
    }
}

struct KycView: View {
    let documents = ["Aadhaar Card", "PAN Card", "Driving Licence", "Selfie"]
    var body: some View {
        List(documents, id: \.self) { doc in
            Button("Upload \(doc)") { /* Camera */ }
        }
        .navigationTitle("KYC Documents")
    }
}
