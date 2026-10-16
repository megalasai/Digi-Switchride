import SwiftUI

@main
struct DigiSwitchrideApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .tint(AppColors.greenPrimary)
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: auth.isAuthenticated)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
            VehicleView()
                .tabItem { Label("Vehicle", systemImage: "scooter") }
            PayView()
                .tabItem { Label("Pay", systemImage: "creditcard") }
            PlanView()
                .tabItem { Label("Plan", systemImage: "doc.text") }
            MoreView()
                .tabItem { Label("More", systemImage: "square.grid.2x2") }
        }
        .tint(AppColors.greenPrimary)
    }
}
