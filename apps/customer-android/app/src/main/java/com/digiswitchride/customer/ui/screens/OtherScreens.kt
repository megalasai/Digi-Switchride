package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.KycStepCard
import com.digiswitchride.customer.ui.components.PrimaryButton
import com.digiswitchride.customer.ui.viewmodel.KycViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KycScreen(onBack: () -> Unit, viewModel: KycViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("KYC documents") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text(
                    "Photograph or attach Aadhaar, PAN, driving licence and a selfie. Admin reviews these in the portal. Blob storage for live camera files is planned.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item { KycStepCard(Icons.Default.Badge, "Aadhaar / address proof", "Tap to mark captured or selected", state.uploaded.contains("Aadhaar")) { viewModel.markUploaded("Aadhaar") } }
            item { KycStepCard(Icons.Default.CreditCard, "PAN", "Tap to mark captured or selected", state.uploaded.contains("PAN")) { viewModel.markUploaded("PAN") } }
            item { KycStepCard(Icons.Default.DirectionsCar, "Driving licence", "Tap to mark captured or selected", state.uploaded.contains("DrivingLicence")) { viewModel.markUploaded("DrivingLicence") } }
            item { KycStepCard(Icons.Default.Face, "Rider photograph", "Tap to mark captured or selected", state.uploaded.contains("Selfie")) { viewModel.markUploaded("Selfie") } }
            item {
                PrimaryButton(text = "Submit for review", onClick = { viewModel.submitAll(onBack) }, loading = state.isLoading)
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}
