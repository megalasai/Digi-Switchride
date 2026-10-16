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
                BrandHeader(title: "Digi-Switchride", subtitle: "Your vehicle, plan, payments and support")
                VStack(spacing: 16) {
                    Text(isRegister ? "Create account" : "Sign in").font(.title2.bold()).frame(maxWidth: .infinity, alignment: .leading)
                    TextField("Username", text: $username).textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password).textFieldStyle(.roundedBorder)
                    if isRegister {
                        TextField("Full name (optional)", text: $fullName).textFieldStyle(.roundedBorder)
                    }
                    Button {
                        Task {
                            if isRegister { await auth.register(username: username, password: password, fullName: fullName) }
                            else { await auth.login(username: username, password: password) }
                        }
                    } label: { Text(isRegister ? "Create account" : "Sign in") }
                    .buttonStyle(PrimaryButtonStyle(loading: auth.isLoading))
                    .disabled(auth.isLoading || username.isEmpty || password.count < 6)
                    Button(isRegister ? "Already have an account? Sign in" : "New here? Create an account") {
                        isRegister.toggle(); auth.error = nil
                    }.font(.footnote)
                    if let error = auth.error { Text(error).font(.footnote).foregroundStyle(AppColors.batteryLow) }
                }
                .padding(20)
                .background(Color(.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal, 24)
                Spacer(minLength: 40)
            }
        }
        .background(LinearGradient(colors: [AppColors.greenPrimary.opacity(0.08), AppColors.background], startPoint: .top, endPoint: .bottom))
    }
}

struct HomeView: View {
    @State private var home: HomeResponse?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Hello \(home?.rider.fullName ?? "")").font(.title.bold())
                    HStack {
                        InfoCard(title: "Wallet", subtitle: "₹\(Int(home?.walletBalance ?? 0))")
                        InfoCard(title: "Due", subtitle: "₹\(Int(home?.outstanding.amount ?? 0))")
                    }
                    InfoCard(title: "Rental plan", subtitle: home?.plan?.name ?? "No plan assigned", extra: home?.plan.map { "₹\(Int($0.charges)) · \($0.billingFrequency)" })
                    InfoCard(title: "Vehicle", subtitle: home?.vehicle?.registrationNumber ?? "No vehicle assigned", extra: home?.vehicle.map { "\($0.model) · \($0.status) · \($0.batteryPercent)%" })
                    if let b = home?.breakdown { InfoCard(title: "Breakdown", subtitle: b.issueType, extra: b.status) }
                    if let s = home?.service { InfoCard(title: "Service", subtitle: s.category, extra: s.status) }
                    if (home?.outstanding.amount ?? 0) > 0 {
                        Button("Pay outstanding now") { Task { _ = try? await APIService.shared.pay(method: "UPI"); await load() } }
                            .buttonStyle(PrimaryButtonStyle())
                    }
                    ForEach(home?.alerts ?? []) { InfoCard(title: $0.title, subtitle: $0.body, extra: $0.status) }
                }.padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("Home")
            .task { await load() }
            .refreshable { await load() }
        }
    }
    private func load() async { home = try? await APIService.shared.home() }
}

struct VehicleView: View {
    @State private var data: VehicleResponse?
    @State private var slots: [SlotItem] = []
    @State private var appointments: [AppointmentItem] = []
    @State private var issue = "Battery"
    @State private var desc = ""
    @State private var category = "General service"
    @State private var svcDesc = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let v = data?.vehicle {
                        InfoCard(title: v.registrationNumber, subtitle: "\(v.model) · \(v.type)", extra: "\(v.status) · battery \(v.batteryPercent)%")
                    } else {
                        Text("No vehicle assigned yet.").foregroundStyle(AppColors.textSecondary)
                    }
                    Text("Report breakdown").font(.headline)
                    TextField("Issue type", text: $issue).textFieldStyle(.roundedBorder)
                    TextField("What happened?", text: $desc, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    Button("Send to Command Center") {
                        Task { _ = try? await APIService.shared.reportBreakdown(issue: issue, description: desc); await load() }
                    }.buttonStyle(PrimaryButtonStyle()).disabled(desc.count < 10)
                    Text("Service request").font(.headline)
                    TextField("Requirement", text: $category).textFieldStyle(.roundedBorder)
                    TextField("Details", text: $svcDesc, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    Button("Raise request") {
                        Task { _ = try? await APIService.shared.raiseService(category: category, description: svcDesc); await load() }
                    }.buttonStyle(PrimaryButtonStyle()).disabled(svcDesc.count < 10)
                    ForEach(data?.breakdowns ?? []) { InfoCard(title: "Breakdown", subtitle: $0.issueType, extra: $0.status) }
                    ForEach(data?.requests ?? []) { InfoCard(title: "Service", subtitle: $0.category, extra: $0.status) }
                    Text("Appointments").font(.headline)
                    ForEach(appointments) { a in
                        HStack {
                            InfoCard(title: a.centreName ?? "Workshop", subtitle: a.status)
                            if a.status != "Cancelled" && a.status != "Completed" {
                                Button("Cancel") { Task { _ = try? await APIService.shared.cancelAppointment(id: a.id); await load() } }
                            }
                        }
                    }
                    Text("Available slots").font(.headline)
                    ForEach(slots.filter { $0.remaining > 0 }) { slot in
                        Button("\(slot.date) \(slot.startTime) · \(slot.remaining) left") {
                            Task { _ = try? await APIService.shared.schedule(centreId: slot.centreId, slotId: slot.id); await load() }
                        }
                    }
                }.padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("Vehicle")
            .task { await load() }
        }
    }
    private func load() async {
        data = try? await APIService.shared.vehicle()
        slots = (try? await APIService.shared.slots().items) ?? []
        appointments = (try? await APIService.shared.appointments().items) ?? []
    }
}

struct PayView: View {
    @State private var home: HomeResponse?
    @State private var payments: [PaymentItem] = []
    @State private var wallet: [WalletItem] = []
    let methods = ["Wallet", "UPI", "QR", "NetBanking", "DebitCard", "CreditCard"]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    InfoCard(title: "Outstanding", subtitle: "₹\(Int(home?.outstanding.amount ?? 0))", extra: "\(home?.outstanding.count ?? 0) dues")
                    InfoCard(title: "Wallet", subtitle: "₹\(Int(home?.walletBalance ?? 0))")
                    Text("Pay now").font(.headline)
                    ForEach(methods, id: \.self) { method in
                        Button(method) { Task { _ = try? await APIService.shared.pay(method: method); await load() } }
                            .buttonStyle(.bordered)
                    }
                    Text("Payment history").font(.headline)
                    ForEach(payments) { InfoCard(title: "₹\(Int($0.amount))", subtitle: $0.method ?? "—", extra: "\($0.status) · \($0.reference ?? "—")") }
                    Text("Wallet ledger").font(.headline)
                    ForEach(wallet) { InfoCard(title: $0.type, subtitle: "₹\(Int($0.amount))", extra: $0.note) }
                }.padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("Pay")
            .task { await load() }
        }
    }
    private func load() async {
        home = try? await APIService.shared.home()
        payments = (try? await APIService.shared.payments().items) ?? []
        wallet = (try? await APIService.shared.wallet().items) ?? []
    }
}

struct PlanView: View {
    @State private var plans: PlansResponse?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(plans?.items ?? []) { plan in
                        let current = plan.id == plans?.currentPlanId
                        VStack(alignment: .leading, spacing: 6) {
                            Text(plan.name).font(.headline)
                            Text("₹\(Int(plan.charges)) · \(plan.durationDays) days · \(plan.billingFrequency)")
                            if let terms = plan.terms { Text(terms).font(.caption).foregroundStyle(AppColors.textSecondary) }
                            if current { StatusBadge(label: "Current") }
                            else { Button("Select this plan") { Task { _ = try? await APIService.shared.changePlan(id: plan.id); await load() } } }
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(current ? AppColors.greenLight : Color(.systemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }.padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("Plan")
            .task { await load() }
        }
    }
    private func load() async { plans = try? await APIService.shared.plans() }
}

struct MoreView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var profile: CustomerProfile?
    @State private var agreements: [AgreementItem] = []
    @State private var stations: [StationItem] = []
    @State private var tickets: [TicketItem] = []
    @State private var referral: ReferralResponse?
    @State private var subject = ""
    @State private var bodyText = ""
    @State private var comment = ""
    @State private var category = "Vehicle"
    @State private var rating = 5.0
    @State private var code = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Profile").font(.title3.bold())
                    LabeledContent("Name", value: profile?.fullName ?? "—")
                    LabeledContent("Mobile", value: profile?.phone ?? "—")
                    LabeledContent("Email", value: profile?.email ?? "—")
                    LabeledContent("KYC", value: profile?.kycStatus ?? "—")
                    Text("Agreements").font(.title3.bold())
                    ForEach(agreements) { InfoCard(title: $0.type, subtitle: $0.status, extra: String($0.content.prefix(120))) }
                    if agreements.isEmpty { Text("No agreements yet.").foregroundStyle(AppColors.textSecondary) }
                    Text("Charging stations").font(.title3.bold())
                    ForEach(stations) { InfoCard(title: $0.name, subtitle: $0.address, extra: "\($0.chargerCount) chargers · \($0.status)") }
                    Text("Help & support").font(.title3.bold())
                    TextField("Subject", text: $subject).textFieldStyle(.roundedBorder)
                    TextField("Details", text: $bodyText, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    Button("Send support request") {
                        Task { _ = try? await APIService.shared.createTicket(category: "General", subject: subject, description: bodyText); await load() }
                    }.buttonStyle(PrimaryButtonStyle())
                    ForEach(tickets) { InfoCard(title: $0.subject, subtitle: $0.category, extra: $0.status) }
                    Text("Feedback").font(.title3.bold())
                    Picker("Category", selection: $category) { ForEach(["Vehicle", "Service", "App"], id: \.self) { Text($0) } }
                    Slider(value: $rating, in: 1...5, step: 1)
                    Text("Rating \(Int(rating)) / 5")
                    TextField("Comments", text: $comment, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    Button("Submit feedback") {
                        Task { _ = try? await APIService.shared.feedback(rating: Int(rating), comment: comment, category: category) }
                    }.buttonStyle(PrimaryButtonStyle()).disabled(comment.count < 5)
                    Text("Refer & earn").font(.title3.bold())
                    InfoCard(title: "Your code", subtitle: referral?.code ?? "Assigned after first sign-in", extra: "\(referral?.referredCount ?? 0) successful referrals")
                    if referral?.referredBy == nil {
                        TextField("Friend's referral code", text: $code).textFieldStyle(.roundedBorder)
                        Button("Apply code") { Task { _ = try? await APIService.shared.applyReferral(code: code); await load() } }
                    }
                    Button("Logout", role: .destructive) { auth.logout() }.frame(maxWidth: .infinity, minHeight: 48)
                }.padding(16)
            }
            .background(AppColors.background)
            .navigationTitle("More")
            .task { await load() }
        }
    }
    private func load() async {
        profile = try? await APIService.shared.getProfile()
        agreements = (try? await APIService.shared.agreements().items) ?? []
        stations = (try? await APIService.shared.stations().items) ?? []
        tickets = (try? await APIService.shared.tickets().items) ?? []
        referral = try? await APIService.shared.referral()
    }
}

struct InfoCard: View {
    let title: String
    var subtitle: String? = nil
    var extra: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            if let subtitle { Text(subtitle) }
            if let extra { Text(extra).font(.caption).foregroundStyle(AppColors.textSecondary) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
