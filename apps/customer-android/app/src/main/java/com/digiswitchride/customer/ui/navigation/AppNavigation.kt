package com.digiswitchride.customer.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.digiswitchride.customer.ui.screens.ActiveRideScreen
import com.digiswitchride.customer.ui.screens.KycScreen
import com.digiswitchride.customer.ui.screens.LoginScreen
import com.digiswitchride.customer.ui.screens.MainScreen
import com.digiswitchride.customer.ui.viewmodel.AuthViewModel

@Composable
fun AppNavigation(authViewModel: AuthViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    val sessionChecked by authViewModel.sessionChecked.collectAsState()
    val hasSession by authViewModel.hasSession.collectAsState()

    if (!sessionChecked) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    NavHost(
        navController = navController,
        startDestination = if (hasSession) "main" else "login",
    ) {
        composable("login") {
            LoginScreen(onAuthenticated = {
                navController.navigate("main") { popUpTo("login") { inclusive = true } }
            })
        }
        composable("main") {
            MainScreen(
                onNavigateToKyc = { navController.navigate("kyc") },
                onNavigateToActiveRide = { rideId ->
                    navController.navigate("active_ride/$rideId")
                },
                onLogout = {
                    authViewModel.logout {
                        navController.navigate("login") { popUpTo("main") { inclusive = true } }
                    }
                },
            )
        }
        composable("kyc") { KycScreen(onBack = { navController.popBackStack() }) }
        composable(
            route = "active_ride/{rideId}",
            arguments = listOf(navArgument("rideId") { type = NavType.StringType }),
        ) { entry ->
            val rideId = entry.arguments?.getString("rideId") ?: return@composable
            ActiveRideScreen(
                rideId = rideId,
                onBack = { navController.popBackStack() },
                onRideEnded = { navController.popBackStack() },
            )
        }
    }

    LaunchedEffect(hasSession) {
        if (hasSession && navController.currentDestination?.route == "login") {
            navController.navigate("main") { popUpTo("login") { inclusive = true } }
        }
    }
}
