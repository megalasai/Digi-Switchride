import SwiftUI

@main
struct DigiSwitchrideApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
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
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Map", systemImage: "map") }
            RideHistoryView()
                .tabItem { Label("History", systemImage: "clock") }
            SupportView()
                .tabItem { Label("Support", systemImage: "headphones") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person") }
        }
        .tint(Color("AccentGreen"))
    }
}
