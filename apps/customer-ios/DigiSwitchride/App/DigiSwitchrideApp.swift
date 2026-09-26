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
                .tabItem { Label("Explore", systemImage: "map") }
            RideHistoryView()
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }
            SupportView()
                .tabItem { Label("Support", systemImage: "headphones") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person") }
        }
        .tint(AppColors.greenPrimary)
    }
}
