package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.ui.components.*
import com.digiswitchride.customer.ui.viewmodel.HomeViewModel
import com.digiswitchride.customer.ui.viewmodel.ProfileViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onNavigateToKyc: () -> Unit,
    onNavigateToActiveRide: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        bottomBar = {
            NavigationBar(tonalElevation = 8.dp) {
                NavigationBarItem(selected = selectedTab == 0, onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Map, null) }, label = { Text("Explore") })
                NavigationBarItem(selected = selectedTab == 1, onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.History, null) }, label = { Text("History") })
                NavigationBarItem(selected = selectedTab == 2, onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.SupportAgent, null) }, label = { Text("Support") })
                NavigationBarItem(selected = selectedTab == 3, onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Person, null) }, label = { Text("Profile") })
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> HomeScreen(onNavigateToKyc = onNavigateToKyc, onNavigateToActiveRide = onNavigateToActiveRide)
                1 -> RideHistoryScreen()
                2 -> SupportScreen()
                3 -> ProfileScreen(onNavigateToKyc = onNavigateToKyc, onLogout = onLogout)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToKyc: () -> Unit,
    onNavigateToActiveRide: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadNearbyHubs()
        viewModel.checkActiveRide(onNavigateToActiveRide)
    }

    LaunchedEffect(state.error, state.message) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
        state.message?.let { snackbarHostState.showSnackbar(it) }
        viewModel.clearMessage()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Find a ride", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("Nagpur, India", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadNearbyHubs() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    if (state.kycStatus != "Approved") {
                        TextButton(onClick = onNavigateToKyc) {
                            Icon(Icons.Default.VerifiedUser, null, Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("KYC")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(140.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Map, null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
                        Text("Nearby hubs", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            if (state.kycStatus != "Approved") {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                        .clickable(onClick = onNavigateToKyc),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                ) {
                    Text(
                        "KYC status: ${state.kycStatus}. Complete KYC and ask admin to approve before booking.",
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            Text(
                "Nearby hubs",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (state.isLoading) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
                if (state.hubs.isEmpty() && !state.isLoading) {
                    item {
                        EmptyState(Icons.Default.LocationOff, "No hubs nearby", "Ask admin to add hubs with vehicles in Nagpur area.")
                    }
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
                if (state.selectedHubId != null) {
                    item {
                        Text(
                            "Available vehicles",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
                if (state.selectedHubVehicles.isEmpty() && state.selectedHubId != null && !state.isLoading) {
                    item { Text("No available vehicles at this hub.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                items(state.selectedHubVehicles) { vehicle ->
                    VehicleCard(
                        model = vehicle.model,
                        registration = vehicle.registrationNumber,
                        battery = vehicle.batteryPercent,
                        canBook = state.kycStatus == "Approved",
                        onBook = { viewModel.bookAndStartRide(vehicle.id, onNavigateToActiveRide) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateToKyc: () -> Unit,
    onLogout: () -> Unit,
    homeViewModel: HomeViewModel = hiltViewModel(),
    profileViewModel: ProfileViewModel = hiltViewModel(),
) {
    val homeState by homeViewModel.state.collectAsState()
    val profileState by profileViewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        profileViewModel.load()
        homeViewModel.refreshKyc()
    }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(modifier = Modifier.size(56.dp), shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                        Spacer(Modifier.width(14.dp))
                        Column {
                            Text(profileState.profile?.fullName ?: profileState.profile?.username ?: "Your account", style = MaterialTheme.typography.titleLarge)
                            StatusChip(homeState.kycStatus, MaterialTheme.colorScheme.primary)
                        }
                    }
                    profileState.profile?.let { p ->
                        Spacer(Modifier.height(12.dp))
                        p.username?.let { Text("Username: $it", style = MaterialTheme.typography.bodyMedium) }
                        p.phone?.let { Text("Phone: $it", style = MaterialTheme.typography.bodyMedium) }
                    }
                }
            }
        }
        item {
            OutlinedCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onNavigateToKyc)) {
                ListItem(
                    headlineContent = { Text("Complete KYC") },
                    supportingContent = { Text("Required before your first ride") },
                    leadingContent = { Icon(Icons.Default.VerifiedUser, null) },
                    trailingContent = { Icon(Icons.Default.ChevronRight, null) },
                )
            }
        }
        item {
            Button(onClick = onLogout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                Text("Logout")
            }
        }
    }
}
