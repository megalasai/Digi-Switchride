package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.BrandHeader
import com.digiswitchride.customer.ui.components.PrimaryButton
import com.digiswitchride.customer.ui.components.TenantLogo
import com.digiswitchride.customer.ui.theme.GradientEnd
import com.digiswitchride.customer.ui.theme.GradientStart
import com.digiswitchride.customer.ui.viewmodel.AuthViewModel

@Composable
fun LoginScreen(onAuthenticated: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    var isRegister by remember { mutableStateOf(false) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val apiHost by viewModel.apiHost.collectAsState()
    val tenantSlug by viewModel.tenantSlug.collectAsState()

    LaunchedEffect(state.isAuthenticated) {
        if (state.isAuthenticated) onAuthenticated()
    }

    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(listOf(GradientStart.copy(alpha = 0.08f), MaterialTheme.colorScheme.background)),
        ),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            <TenantLogo(state.optionalLogoUrl)
            Spacer(Modifier.height(28.dp))
            BrandHeader(
                state.productName.ifBlank { "Digi-Switchride" },
                "Your vehicle, plan, payments and support",
            )
            Spacer(Modifier.height(40.dp))

            Card(shape = RoundedCornerShape(20.dp), elevation = CardDefaults.cardElevation(4.dp)) {
                Column(Modifier.padding(20.dp)) {
                    Text(
                        if (isRegister) "Create account" else "Sign in",
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Spacer(Modifier.height(16.dp))

                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("Username") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    if (isRegister) {
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it },
                            label = { Text("Full name (optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                        )
                    }
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(
                        value = tenantSlug,
                        onValueChange = { viewModel.updateTenantSlug(it) },
                        label = { Text("Organization slug") },
                        placeholder = { Text("digi-switchride") },
                        supportingText = { Text("Your operator’s organization id") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = apiHost,
                        onValueChange = { viewModel.updateApiHost(it) },
                        label = { Text("API server") },
                        placeholder = { Text("192.168.0.50:4000") },
                        supportingText = {
                            Text("Emulator: 10.0.2.2:4000 · Phone: your PC IP from ipconfig")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    Spacer(Modifier.height(20.dp))
                    PrimaryButton(
                        text = if (isRegister) "Create account" else "Sign in",
                        onClick = {
                            if (isRegister) viewModel.register(username, password, fullName)
                            else viewModel.login(username, password)
                        },
                        loading = state.isLoading,
                        enabled = username.isNotBlank() && password.length >= 6,
                    )
                    TextButton(
                        onClick = {
                            isRegister = !isRegister
                            viewModel.clearError()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            if (isRegister) "Already have an account? Sign in"
                            else "New here? Create an account",
                        )
                    }
                    state.error?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}
