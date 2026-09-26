import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var isRegister = false
    @State private var username = ""
    @State private var password = ""
    @State private var fullName = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer(minLength: 40)
                BrandHeader(title: "Digi-Switchride", subtitle: "Electric rides at your fingertips")

                VStack(spacing: 16) {
                    Text(isRegister ? "Create account" : "Sign in")
                        .font(.title2.bold())
                        .frame(maxWidth: .infinity, alignment: .leading)

                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                        .padding(.horizontal, 4)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .padding(.horizontal, 4)

                    if isRegister {
                        TextField("Full name (optional)", text: $fullName)
                            .textFieldStyle(.roundedBorder)
                            .padding(.horizontal, 4)
                    }

                    Button {
                        Task {
                            if isRegister {
                                await auth.register(username: username, password: password, fullName: fullName)
                            } else {
                                await auth.login(username: username, password: password)
                            }
                        }
                    } label: {
                        Text(isRegister ? "Create account" : "Sign in")
                    }
                    .buttonStyle(PrimaryButtonStyle(loading: auth.isLoading))
                    .disabled(auth.isLoading || username.isEmpty || password.count < 6)

                    Button(isRegister ? "Already have an account? Sign in" : "New here? Create an account") {
                        isRegister.toggle()
                        auth.error = nil
                    }
                    .font(.footnote)

                    if let error = auth.error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(AppColors.batteryLow)
                    }
                }
                .padding(20)
                .background(Color(.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
                .padding(.horizontal, 24)

                Spacer(minLength: 40)
            }
        }
        .background(
            LinearGradient(
                colors: [AppColors.greenPrimary.opacity(0.08), AppColors.background],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}

struct HomeView: View {
    @State private var hubs: [RentalHubSummary] = []
    @State private var vehicles: [VehicleSummary] = []
    @State private var selectedHubId: String?
    @State private var kycStatus = "NotSubmitted"
    @State private var showActiveRide = false
    @State private var showKyc = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    MapPlaceholder()
                        .padding(.horizontal, 16)

                    Text("Nearby hubs")
                        .font(.title3.bold())
                        .padding(.horizontal, 16)

                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    }

                    LazyVStack(spacing: 10) {
                        ForEach(hubs) { hub in
                            HubCard(
                                name: hub.name,
                                distanceKm: hub.distanceKm,
                                available: hub.availableVehicles,
                                selected: selectedHubId == hub.id
                            ) {
                                selectedHubId = hub.id
                                Task {
                                    vehicles = (try? await APIService.shared.getHubVehicles(hubId: hub.id).items) ?? []
                                }
                            }
                        }

                        ForEach(vehicles) { vehicle in
                            VehicleCard(
                                model: vehicle.model,
                                registration: vehicle.registrationNumber,
                                battery: vehicle.batteryPercent
                            ) {
                                Task {
                                    if let booking = try? await APIService.shared.createBooking(vehicleId: vehicle.id),
                                       let rideId = booking.rideId {
                                        _ = try? await APIService.shared.startRide(rideId: rideId)
                                        showActiveRide = true
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.vertical, 8)
            }
            .background(AppColors.background)
            .navigationTitle("Find a ride")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if kycStatus != "Approved" {
                        Button { showKyc = true } label: {
                            Label("KYC", systemImage: "checkmark.shield")
                        }
                        .tint(AppColors.greenPrimary)
                    }
                }
            }
            .task {
                isLoading = true
                hubs = (try? await APIService.shared.getNearbyHubs(lat: 21.1458, lng: 79.0882).items) ?? []
                kycStatus = (try? await APIService.shared.getKycStatus().status) ?? "NotSubmitted"
                isLoading = false
            }
            .sheet(isPresented: $showActiveRide) { ActiveRideView() }
            .navigationDestination(isPresented: $showKyc) { KycView() }
        }
    }
}

struct ActiveRideView: View {
    @Environment(\.dismiss) var dismiss
    @State private var elapsed = 0
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            RoundedRectangle(cornerRadius: 24)
                .fill(AppColors.greenLight)
                .frame(height: 220)
                .overlay {
                    VStack(spacing: 16) {
                        Image(systemName: "scooter")
                            .font(.system(size: 48))
                            .foregroundStyle(AppColors.greenPrimary)
                        Text("Ride in progress")
                            .font(.title2.bold())
                        Text(String(format: "%02d:%02d", elapsed / 60, elapsed % 60))
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .foregroundStyle(AppColors.greenPrimary)
                    }
                }
                .padding(.horizontal, 24)

            Button("End ride") { dismiss() }
                .buttonStyle(.borderedProminent)
                .tint(AppColors.batteryLow)
                .frame(maxWidth: .infinity, minHeight: 52)
                .padding(.horizontal, 24)
            Spacer()
        }
        .background(AppColors.background)
        .onReceive(timer) { _ in elapsed += 1 }
    }
}

struct RideHistoryView: View {
    var body: some View {
        NavigationStack {
            EmptyStateView(
                icon: "clock.arrow.circlepath",
                title: "No rides yet",
                message: "Your completed rides and receipts will appear here."
            )
            .background(AppColors.background)
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
            VStack(spacing: 16) {
                TextField("Subject", text: $subject)
                    .textFieldStyle(.roundedBorder)
                TextField("Describe your issue", text: $description, axis: .vertical)
                    .lineLimit(4...8)
                    .textFieldStyle(.roundedBorder)
                Button("Submit ticket") {
                    Task {
                        try? await APIService.shared.createTicket(category: "General", subject: subject, description: description)
                        submitted = true
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                Spacer()
            }
            .padding(16)
            .background(AppColors.background)
            .navigationTitle("Help & support")
            .alert("Ticket submitted", isPresented: $submitted) { Button("OK") {} }
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var profile: CustomerProfile?
    @State private var showKyc = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(AppColors.greenLight)
                                .frame(width: 56, height: 56)
                                .overlay {
                                    Image(systemName: "person.fill")
                                        .foregroundStyle(AppColors.greenPrimary)
                                }
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Your account").font(.title2.bold())
                                StatusBadge(label: profile?.kycStatus ?? "NotSubmitted")
                            }
                        }
                        if let p = profile {
                            Divider()
                            if let username = p.username {
                                LabeledContent("Username", value: username)
                            }
                            if let phone = p.phone {
                                LabeledContent("Phone", value: phone)
                            }
                            LabeledContent("Name", value: p.fullName ?? "—")
                        }
                    }
                    .padding(20)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 20))

                    Button { showKyc = true } label: {
                        HStack {
                            Image(systemName: "checkmark.shield")
                            VStack(alignment: .leading) {
                                Text("Complete KYC").font(.headline)
                                Text("Required before your first ride").font(.caption).foregroundStyle(AppColors.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .padding(16)
                    }
                    .buttonStyle(.plain)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    Button("Logout", role: .destructive) { auth.logout() }
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("Profile")
            .task { profile = try? await APIService.shared.getProfile() }
            .navigationDestination(isPresented: $showKyc) { KycView() }
        }
    }
}

struct KycView: View {
    @Environment(\.dismiss) var dismiss

    let steps: [(String, String, String)] = [
        ("person.text.rectangle", "Aadhaar Card", "Government ID verification"),
        ("creditcard", "PAN Card", "Tax identity verification"),
        ("car", "Driving Licence", "Valid two-wheeler licence"),
        ("face.smiling", "Selfie / Liveness", "Face match with documents"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Upload documents to start riding. All data is encrypted and stored securely.")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)

                ForEach(steps, id: \.1) { step in
                    KycStepRow(icon: step.0, title: step.1, subtitle: step.2)
                }

                Button("Submit for review") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 8)
            }
            .padding(16)
        }
        .background(AppColors.background)
        .navigationTitle("Verify identity")
    }
}
