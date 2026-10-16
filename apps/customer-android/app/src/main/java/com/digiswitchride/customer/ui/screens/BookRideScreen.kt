package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.EmptyState
import com.digiswitchride.customer.ui.components.HubCard
import com.digiswitchride.customer.ui.components.VehicleCard
import com.digiswitchride.customer.ui.viewmodel.BookRideViewModel

@Composable
fun BookRideMore(onActiveRide: (String) -> Unit, viewModel: BookRideViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(state.error, state.message) {
        state.error?.let { snackbar.showSnackbar(it) }
        state.message?.let { snackbar.showSnackbar(it) }
        viewModel.clearMessage()
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        LazyColumn(
            Modifier.padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text("Nearby hubs", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("On-demand ride booking (requires approved KYC)", style = MaterialTheme.typography.bodySmall)
            }
            if (state.isLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (state.hubs.isEmpty() && !state.isLoading) {
                item { EmptyState(Icons.Default.LocationOff, "No hubs", "Admin must add active hubs near Nagpur.") }
            }
            items(state.hubs) { hub ->
                HubCard(
                    name = hub.name,
                    distanceKm = hub.distanceKm,
                    available = hub.availableVehicles,
                    selected = state.selectedHubId == hub.id,
                    onClick = { viewModel.selectHub(hub.id) },
                )
            }
            items(state.vehicles) { vehicle ->
                VehicleCard(
                    model = vehicle.model,
                    registration = vehicle.registrationNumber,
                    battery = vehicle.batteryPercent,
                    canBook = state.kycStatus == "Approved",
                    onBook = { viewModel.bookAndStart(vehicle.id, onActiveRide) },
                    type = vehicle.type,
                    wheelClass = vehicle.wheelClass,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveRideScreen(
    rideId: String,
    onBack: () -> Unit,
    onRideEnded: () -> Unit,
    viewModel: com.digiswitchride.customer.ui.viewmodel.ActiveRideViewModel = hiltViewModel(),
) {
    var elapsed by remember { mutableIntStateOf(0) }
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            elapsed++
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Active ride") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().padding(24.dp),
            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Surface(shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.primaryContainer) {
                Column(Modifier.padding(32.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Icon(Icons.Default.TwoWheeler, null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
                    Text("Ride in progress", style = MaterialTheme.typography.titleLarge)
                    Text("%02d:%02d".format(elapsed / 60, elapsed % 60), style = MaterialTheme.typography.displayLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.height(24.dp))
            if (state.ended && state.fare != null) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Fare: ₹${"%.2f".format(state.fare)}", style = MaterialTheme.typography.headlineSmall)
                        state.paymentId?.let { Text("Payment ref: ${it.takeLast(8)}", style = MaterialTheme.typography.bodySmall) }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
            Button(
                onClick = { if (state.ended) onRideEnded() else viewModel.endRide(rideId) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !state.isLoading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.ended) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                ),
            ) {
                Text(if (state.ended) "Done" else "End ride")
            }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}
