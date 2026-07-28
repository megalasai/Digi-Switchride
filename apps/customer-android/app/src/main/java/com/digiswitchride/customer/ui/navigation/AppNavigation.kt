package com.digiswitchride.customer.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.digiswitchride.customer.ui.screens.*

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(onAuthenticated = {
                navController.navigate("home") { popUpTo("login") { inclusive = true } }
            })
        }
        composable("home") {
            HomeScreen(
                onNavigateToKyc = { navController.navigate("kyc") },
                onNavigateToHistory = { navController.navigate("history") },
                onNavigateToSupport = { navController.navigate("support") },
                onNavigateToActiveRide = { navController.navigate("active_ride") }
            )
        }
        composable("kyc") { KycScreen(onComplete = { navController.popBackStack() }) }
        composable("history") { RideHistoryScreen(onBack = { navController.popBackStack() }) }
        composable("support") { SupportScreen(onBack = { navController.popBackStack() }) }
        composable("active_ride") { ActiveRideScreen(onRideEnded = { navController.popBackStack() }) }
    }
}
