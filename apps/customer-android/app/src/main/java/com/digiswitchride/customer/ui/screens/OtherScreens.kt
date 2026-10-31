package com.digiswitchride.customer.ui.screens

import android.Manifest
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.KycStepCard
import com.digiswitchride.customer.ui.components.PrimaryButton
import com.digiswitchride.customer.ui.viewmodel.KycViewModel
import com.digiswitchride.customer.util.KycCaptureFiles
import com.digiswitchride.customer.util.KycImageEncoder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KycScreen(onBack: () -> Unit, viewModel: KycViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var pendingType by remember { mutableStateOf<String?>(null) }
    var pendingDataUrl by remember { mutableStateOf<String?>(null) }
    var docNumber by remember { mutableStateOf("") }
    var showSourcePicker by remember { mutableStateOf(false) }
    var showNumberDialog by remember { mutableStateOf(false) }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val type = pendingType
        val uri = cameraUri
        cameraUri = null
        if (!ok || uri == null || type == null) {
            if (type != null && !ok) viewModel.reportError("Camera capture was cancelled or failed.")
            return@rememberLauncherForActivityResult
        }
        runCatching {
            pendingDataUrl = KycImageEncoder.uriToDataUrl(context, uri)
            if (type == "Aadhaar" || type == "PAN") showNumberDialog = true
            else viewModel.uploadDocument(type, pendingDataUrl!!, null)
        }.onFailure { e ->
            viewModel.reportError(e.message ?: "Could not read photo")
        }
    }

    val pickGallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val type = pendingType ?: return@rememberLauncherForActivityResult
        if (uri == null) return@rememberLauncherForActivityResult
        runCatching {
            pendingDataUrl = KycImageEncoder.uriToDataUrl(context, uri)
            if (type == "Aadhaar" || type == "PAN") showNumberDialog = true
            else viewModel.uploadDocument(type, pendingDataUrl!!, null)
        }.onFailure { e ->
            viewModel.reportError(e.message ?: "Could not read image")
        }
    }

    val requestCamera = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            val (_, uri) = KycCaptureFiles.newCameraPhoto(context)
            cameraUri = uri
            takePicture.launch(uri)
        } else {
            viewModel.reportError("Camera permission is required to take KYC photos.")
        }
    }

    fun startCapture(type: String) {
        pendingType = type
        docNumber = ""
        showSourcePicker = true
    }

    if (showSourcePicker && pendingType != null) {
        AlertDialog(
            onDismissRequest = { showSourcePicker = false },
            title = { Text("Add ${pendingType}") },
            text = { Text("Take a photo with the camera or choose from gallery.") },
            confirmButton = {
                TextButton(onClick = {
                    showSourcePicker = false
                    when {
                        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                            android.content.pm.PackageManager.PERMISSION_GRANTED -> {
                            val (_, uri) = KycCaptureFiles.newCameraPhoto(context)
                            cameraUri = uri
                            takePicture.launch(uri)
                        }
                        else -> requestCamera.launch(Manifest.permission.CAMERA)
                    }
                }) { Text("Camera") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showSourcePicker = false
                    pickGallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }) { Text("Gallery") }
            },
        )
    }

    if (showNumberDialog && pendingType != null && pendingDataUrl != null) {
        AlertDialog(
            onDismissRequest = { showNumberDialog = false },
            title = { Text("${pendingType} number") },
            text = {
                OutlinedTextField(
                    value = docNumber,
                    onValueChange = { docNumber = it },
                    label = { Text("Last 4 digits or full number (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showNumberDialog = false
                    viewModel.uploadDocument(pendingType!!, pendingDataUrl!!, docNumber)
                    pendingType = null
                    pendingDataUrl = null
                }) { Text("Upload") }
            },
        )
    }

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
                    "Status: ${state.overallStatus}" + (state.rejectionReason?.let { " — $it" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item {
                Text(
                    "Photograph or attach Aadhaar, PAN, driving licence and a selfie. Documents are sent securely to admin for approval.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item {
                KycStepCard(Icons.Default.Badge, "Aadhaar / address proof", "Camera or gallery", state.uploaded.contains("Aadhaar")) {
                    startCapture("Aadhaar")
                }
            }
            item {
                KycStepCard(Icons.Default.CreditCard, "PAN", "Camera or gallery", state.uploaded.contains("PAN")) {
                    startCapture("PAN")
                }
            }
            item {
                KycStepCard(Icons.Default.DirectionsCar, "Driving licence", "Camera or gallery", state.uploaded.contains("DrivingLicence")) {
                    startCapture("DrivingLicence")
                }
            }
            item {
                KycStepCard(Icons.Default.Face, "Rider photograph", "Camera or gallery", state.uploaded.contains("Selfie")) {
                    startCapture("Selfie")
                }
            }
            item {
                PrimaryButton(text = "Submit for review", onClick = { viewModel.submitAll(onBack) }, loading = state.isLoading)
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}
