package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.viewmodel.HomeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToKyc: () -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToSupport: () -> Unit,
    onNavigateToActiveRide: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadNearbyHubs(21.1458, 79.0882) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nearby Hubs") },
                actions = {
                    IconButton(onClick = onNavigateToHistory) { Icon(Icons.Default.History, "History") }
                    IconButton(onClick = onNavigateToSupport) { Icon(Icons.Default.Support, "Support") }
                }
            )
        },
        floatingActionButton = {
            if (state.kycStatus != "Approved") {
                ExtendedFloatingActionButton(onClick = onNavigateToKyc, icon = { Icon(Icons.Default.VerifiedUser, null) }, text = { Text("Complete KYC") })
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (state.isLoading) {
                item { CircularProgressIndicator() }
            }
            items(state.hubs) { hub ->
                Card(onClick = { viewModel.selectHub(hub.id) }, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(hub.name, style = MaterialTheme.typography.titleMedium)
                        Text("${hub.availableVehicles} vehicles available • ${hub.distanceKm} km away", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            state.selectedHubVehicles.forEach { vehicle ->
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(vehicle.model, style = MaterialTheme.typography.titleSmall)
                                Text("${vehicle.registrationNumber} • ${vehicle.batteryPercent}% battery")
                            }
                            Button(onClick = {
                                viewModel.bookVehicle(vehicle.id) { rideId ->
                                    viewModel.startRide(rideId) { onNavigateToActiveRide() }
                                }
                            }) { Text("Book & Ride") }
                        }
                    }
                }
            }
        }
    }
}
