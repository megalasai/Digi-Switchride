package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.viewmodel.AuthViewModel
import androidx.compose.foundation.text.KeyboardOptions

@Composable
fun LoginScreen(onAuthenticated: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    var phone by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var otpSent by remember { mutableStateOf(false) }
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.isAuthenticated) {
        if (state.isAuthenticated) onAuthenticated()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Digi-Switchride", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
        Text("Electric rides at your fingertips", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(bottom = 32.dp))

        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Phone (+91...)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth()
        )

        if (otpSent) {
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = otp,
                onValueChange = { otp = it },
                label = { Text("OTP") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (!otpSent) {
                    viewModel.sendOtp(phone)
                    otpSent = true
                } else {
                    viewModel.verifyOtp(phone, otp)
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.isLoading
        ) {
            Text(if (otpSent) "Verify OTP" else "Send OTP")
        }

        state.error?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
fun KycScreen(onComplete: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Complete KYC", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Upload the following documents:", style = MaterialTheme.typography.bodyLarge)
        Spacer(modifier = Modifier.height(16.dp))
        listOf("Aadhaar Card", "PAN Card", "Driving Licence", "Selfie / Liveness").forEach { doc ->
            OutlinedButton(onClick = { /* Camera capture */ }, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text("Upload $doc")
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) {
            Text("Submit for Review")
        }
    }
}

@Composable
fun SupportScreen(onBack: () -> Unit) {
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Contact Support", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth().height(120.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Submit Ticket") }
    }
}

@Composable
fun RideHistoryScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Ride History", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Your past rides will appear here.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onBack) { Text("Back") }
    }
}

@Composable
fun ActiveRideScreen(onRideEnded: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("Ride In Progress", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.height(16.dp))
        Text("00:00", style = MaterialTheme.typography.displayMedium)
        Spacer(modifier = Modifier.height(32.dp))
        Button(onClick = onRideEnded, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error), modifier = Modifier.fillMaxWidth()) {
            Text("End Ride")
        }
    }
}
