package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.EmptyState
import com.digiswitchride.customer.ui.components.KycStepCard
import com.digiswitchride.customer.ui.components.PrimaryButton
import com.digiswitchride.customer.ui.viewmodel.ActiveRideViewModel
import com.digiswitchride.customer.ui.viewmodel.KycViewModel
import com.digiswitchride.customer.ui.viewmodel.RideHistoryViewModel
import com.digiswitchride.customer.ui.viewmodel.SupportViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KycScreen(onBack: () -> Unit, viewModel: KycViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Verify identity") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text(
                    "Upload documents to start riding. After submit, an admin must approve your KYC in the web portal.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
            }
            item {
                KycStepCard(Icons.Default.Badge, "Aadhaar Card", "Tap to mark uploaded", state.uploaded.contains("Aadhaar")) {
                    viewModel.markUploaded("Aadhaar")
                }
            }
            item {
                KycStepCard(Icons.Default.CreditCard, "PAN Card", "Tap to mark uploaded", state.uploaded.contains("PAN")) {
                    viewModel.markUploaded("PAN")
                }
            }
            item {
                KycStepCard(Icons.Default.DirectionsCar, "Driving Licence", "Tap to mark uploaded", state.uploaded.contains("DrivingLicence")) {
                    viewModel.markUploaded("DrivingLicence")
                }
            }
            item {
                KycStepCard(Icons.Default.Face, "Selfie / Liveness", "Tap to mark uploaded", state.uploaded.contains("Selfie")) {
                    viewModel.markUploaded("Selfie")
                }
            }
            item {
                Spacer(Modifier.height(8.dp))
                PrimaryButton(
                    text = "Submit for review",
                    onClick = { viewModel.submitAll(onBack) },
                    loading = state.isLoading,
                )
                state.error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RideHistoryScreen(viewModel: RideHistoryViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    Scaffold(topBar = { TopAppBar(title = { Text("Ride history") }) }) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (state.rides.isEmpty()) {
            EmptyState(Icons.Default.History, "No rides yet", state.error ?: "Your completed rides will appear here.")
        } else {
            LazyColumn(Modifier.padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(state.rides) { ride ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Ride #${ride.id.takeLast(6)}", style = MaterialTheme.typography.titleMedium)
                            Text("Status: ${ride.status}", style = MaterialTheme.typography.bodyMedium)
                            ride.durationMinutes?.let { Text("Duration: $it min", style = MaterialTheme.typography.bodySmall) }
                            ride.endedAt?.let { Text("Ended: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(viewModel: SupportViewModel = hiltViewModel()) {
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.success) {
        if (state.success) {
            snackbarHostState.showSnackbar("Support ticket submitted")
            subject = ""
            description = ""
            viewModel.clearSuccess()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = { TopAppBar(title = { Text("Help & support") }) },
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Describe your issue") }, modifier = Modifier.fillMaxWidth().height(120.dp))
            Spacer(Modifier.height(16.dp))
            PrimaryButton(text = "Submit ticket", onClick = { viewModel.submit(subject, description) }, loading = state.isLoading)
            state.error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
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
    viewModel: ActiveRideViewModel = hiltViewModel(),
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
            modifier = Modifier.padding(padding).fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Surface(shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.primaryContainer) {
                Column(Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.TwoWheeler, null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(16.dp))
                    Text("Ride in progress", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(8.dp))
                    Text("%02d:%02d".format(elapsed / 60, elapsed % 60), style = MaterialTheme.typography.displayLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.height(24.dp))
            if (state.ended && state.fare != null) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Ride completed", style = MaterialTheme.typography.titleMedium)
                        Text("Fare: ₹${"%.2f".format(state.fare)}", style = MaterialTheme.typography.headlineSmall)
                        state.paymentId?.let {
                            Text("Payment recorded (ID: ${it.takeLast(8)})", style = MaterialTheme.typography.bodySmall)
                        }
                        Text("Pay at hub or via app when online payments are enabled.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                if (state.isLoading) CircularProgressIndicator(modifier = Modifier.size(22.dp))
                else Text(if (state.ended) "Done" else "End ride")
            }
            state.error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
