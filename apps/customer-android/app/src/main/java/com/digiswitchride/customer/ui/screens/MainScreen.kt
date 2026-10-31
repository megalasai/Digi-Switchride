package com.digiswitchride.customer.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.digiswitchride.customer.data.api.RiderPlan
import com.digiswitchride.customer.ui.components.EmptyState
import com.digiswitchride.customer.ui.components.StatusChip
import com.digiswitchride.customer.ui.components.TenantLogo
import com.digiswitchride.customer.ui.components.vehicleIcon
import com.digiswitchride.customer.ui.util.formatInr
import com.digiswitchride.customer.ui.viewmodel.ProfileViewModel
import com.digiswitchride.customer.ui.viewmodel.RiderAppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onNavigateToKyc: () -> Unit,
    onLogout: () -> Unit,
    onNavigateToActiveRide: (String) -> Unit,
    vm: RiderAppViewModel = hiltViewModel(),
) {
    var tab by remember { mutableIntStateOf(0) }
    var morePage by remember { mutableStateOf<String?>(null) }
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.refreshHome() }
    LaunchedEffect(state.error, state.message) {
        state.error?.let { snackbar.showSnackbar(it) }
        state.message?.let { snackbar.showSnackbar(it) }
        vm.clearMessage()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(selected = tab == 0, onClick = { tab = 0; morePage = null; vm.refreshHome() }, icon = { Icon(Icons.Default.Home, null) }, label = { Text("Home") })
                NavigationBarItem(selected = tab == 1, onClick = { tab = 1; morePage = null; vm.refreshVehicle() }, icon = { Icon(Icons.Default.TwoWheeler, null) }, label = { Text("Vehicle") })
                NavigationBarItem(selected = tab == 2, onClick = { tab = 2; morePage = null; vm.refreshPay() }, icon = { Icon(Icons.Default.AccountBalanceWallet, null) }, label = { Text("Pay") })
                NavigationBarItem(selected = tab == 3, onClick = { tab = 3; morePage = null; vm.refreshPlans() }, icon = { Icon(Icons.Default.Assignment, null) }, label = { Text("Plan") })
                NavigationBarItem(selected = tab == 4, onClick = { tab = 4 }, icon = { Icon(Icons.Default.GridView, null) }, label = { Text("More") })
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when {
                tab == 4 && morePage != null -> MoreDetail(morePage!!, { morePage = null }, onNavigateToKyc, onLogout, onNavigateToActiveRide, vm)
                tab == 0 -> HomeTab(vm, onNavigateToKyc)
                tab == 1 -> VehicleTab(vm)
                tab == 2 -> PayTab(vm)
                tab == 3 -> PlanTab(vm)
                else -> MoreMenu({ morePage = it }, vm)
            }
        }
    }
}

@Composable
private fun HomeTab(vm: RiderAppViewModel, onKyc: () -> Unit) {
    val ui = vm.state.collectAsState().value
    val home = ui.home
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Hello ${home?.rider?.fullName ?: ""}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                TenantLogo(ui.tenantLogoUrl, showLabel = false)
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatMini("Wallet", formatInr(home?.walletBalance), Modifier.weight(1f))
                StatMini("Due", formatInr(home?.outstanding?.amount), Modifier.weight(1f))
            }
        }
        item {
            InfoCard("Rental plan", home?.plan?.name ?: "No plan assigned", home?.plan?.let { "${formatInr(it.charges)} · ${it.billingFrequency}" })
        }
        item {
            InfoCard("Vehicle", home?.vehicle?.registrationNumber ?: "No vehicle assigned", home?.vehicle?.let { "${it.model} · ${it.status} · ${it.batteryPercent}%" } ?: "Unassigned — check Vehicle tab")
        }
        home?.breakdown?.let { item { InfoCard("Breakdown", it.issueType, it.status) } }
        home?.service?.let { item { InfoCard("Service", it.category, it.status) } }
        if ((home?.outstanding?.amount ?: 0.0) > 0) {
            item {
                Button(onClick = { vm.pay("UPI") }, modifier = Modifier.fillMaxWidth()) { Text("Pay outstanding now") }
            }
        }
        item {
            Card(Modifier.fillMaxWidth().clickable(onClick = onKyc), colors = CardDefaults.cardColors(MaterialTheme.colorScheme.primaryContainer)) {
                ListItem(headlineContent = { Text("KYC ${home?.rider?.kycStatus ?: ""}") }, supportingContent = { Text("Upload documents") }, leadingContent = { Icon(Icons.Default.VerifiedUser, null) })
            }
        }
        items(home?.alerts ?: emptyList()) { alert ->
            InfoCard(alert.title, alert.body, alert.status)
        }
        if (home == null) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun VehicleTab(vm: RiderAppViewModel) {
    val s = vm.state.collectAsState().value
    var screen by remember { mutableStateOf("hub") }
    var issue by remember { mutableStateOf("Battery") }
    var desc by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General service") }
    var svcDesc by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { vm.refreshVehicle() }

    when (screen) {
        "breakdown_form" -> VehicleFormScaffold("Report breakdown", { screen = "hub" }) {
            OutlinedTextField(issue, { issue = it }, label = { Text("Issue type") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(desc, { desc = it }, label = { Text("What happened?") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            Button(onClick = { vm.reportBreakdown(issue, desc); screen = "hub" }, modifier = Modifier.fillMaxWidth(), enabled = desc.length >= 10) {
                Text("Send to Command Center")
            }
        }
        "service_form" -> VehicleFormScaffold("Service request", { screen = "hub" }) {
            OutlinedTextField(category, { category = it }, label = { Text("Requirement") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(svcDesc, { svcDesc = it }, label = { Text("Details") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            Button(onClick = { vm.raiseService(category, svcDesc); screen = "hub" }, modifier = Modifier.fillMaxWidth(), enabled = svcDesc.length >= 10) {
                Text("Raise request")
            }
        }
        "breakdown_list" -> VehicleFormScaffold("Breakdown history", { screen = "hub" }) {
            val items = s.vehicle?.breakdowns ?: emptyList()
            if (items.isEmpty()) EmptyState(Icons.Default.Warning, "No breakdowns", "Your reports will appear here.")
            else items.forEach { b -> InfoCard(b.issueType, b.description, b.status) }
        }
        "service_list" -> VehicleFormScaffold("Service history", { screen = "hub" }) {
            val items = s.vehicle?.requests ?: emptyList()
            if (items.isEmpty()) EmptyState(Icons.Default.Build, "No service requests", "Your workshop requests will appear here.")
            else items.forEach { r -> InfoCard(r.category, r.description, r.status) }
        }
        else -> LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("My vehicle", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            val v = s.vehicle?.vehicle
            if (v == null) {
                item { EmptyState(Icons.Default.TwoWheeler, "No vehicle assigned", "Your operator will assign a vehicle, or pick one below if available.") }
                items(s.availableVehicles) { option ->
                    OutlinedCard(Modifier.clickable { vm.assignVehicle(option.id) }) {
                        ListItem(
                            headlineContent = { Text(option.registrationNumber) },
                            supportingContent = { Text("${option.model} · battery ${option.batteryPercent}% · tap to assign") },
                            leadingContent = { Icon(vehicleIcon(option.type, option.wheelClass), null) },
                        )
                    }
                }
            } else {
                item {
                    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(MaterialTheme.colorScheme.primaryContainer)) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(vehicleIcon(v.type, v.wheelClass), null, Modifier.size(40.dp))
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(v.registrationNumber, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                Text("${v.model} · ${v.status}", style = MaterialTheme.typography.bodyMedium)
                                Text("Battery ${v.batteryPercent}%", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { screen = "breakdown_form" }, modifier = Modifier.weight(1f)) { Text("Report breakdown") }
                        OutlinedButton(onClick = { screen = "service_form" }, modifier = Modifier.weight(1f)) { Text("Service request") }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { screen = "breakdown_list" }, modifier = Modifier.weight(1f)) { Text("View breakdowns") }
                        TextButton(onClick = { screen = "service_list" }, modifier = Modifier.weight(1f)) { Text("View service") }
                    }
                }
            }
            if (s.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        }
    }
}

@Composable
private fun VehicleFormScaffold(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        content()
    }
}

@Composable
private fun PayTab(vm: RiderAppViewModel) {
    val s = vm.state.collectAsState().value
    val methods = s.home?.paymentGateway?.methods?.takeIf { it.isNotEmpty() }
        ?: listOf("Wallet", "UPI", "QR", "NetBanking", "DebitCard", "CreditCard")
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { InfoCard("Outstanding", formatInr(s.home?.outstanding?.amount), "${s.home?.outstanding?.count ?: 0} dues") }
        item { InfoCard("Wallet", formatInr(s.home?.walletBalance), "Credits and debits below") }
        item { Text("Pay now", fontWeight = FontWeight.SemiBold) }
        items(methods) { method ->
            OutlinedButton(onClick = { vm.pay(method) }, modifier = Modifier.fillMaxWidth()) { Text(method) }
        }
        item { Text("Payment history", fontWeight = FontWeight.SemiBold) }
        items(s.payments) { p -> InfoCard(formatInr(p.amount), p.method ?: "—", "${p.status} · ${p.reference ?: "—"}") }
        item { Text("Wallet ledger", fontWeight = FontWeight.SemiBold) }
        items(s.wallet) { w -> InfoCard(w.type, formatInr(w.amount), w.note) }
    }
}

@Composable
private fun PlanTab(vm: RiderAppViewModel) {
    val ui = vm.state.collectAsState().value
    val plans = ui.plans
    LaunchedEffect(Unit) { vm.refreshPlans() }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Rental plans", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        if (ui.loading && plans == null) {
            item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        } else if (plans?.items.isNullOrEmpty()) {
            item { EmptyState(Icons.Default.Assignment, "No plans yet", "Your operator has not published rental plans. Contact support.") }
        } else {
            items(plans!!.items) { plan: RiderPlan ->
                val current = plan.id == plans.currentPlanId
                Card(
                    Modifier.fillMaxWidth(),
                    colors = if (current) CardDefaults.cardColors(MaterialTheme.colorScheme.primaryContainer) else CardDefaults.cardColors(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(plan.name, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            if (current) StatusChip("Current", MaterialTheme.colorScheme.primary)
                        }
                        Text("${formatInr(plan.charges)} · ${plan.durationDays} days · ${plan.billingFrequency}")
                        plan.eligibility?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        plan.terms?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        if (!current) {
                            Button(onClick = { vm.changePlan(plan.id) }, modifier = Modifier.fillMaxWidth()) { Text("Select this plan") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MoreMenu(onOpen: (String) -> Unit, vm: RiderAppViewModel) {
    val items = listOf(
        "profile" to "My profile",
        "docs" to "Agreements & KYC",
        "book" to "Book a ride (nearby hubs)",
        "stations" to "Charging stations",
        "support" to "Help & support",
        "feedback" to "Feedback & rating",
        "refer" to "Refer & earn",
        "workshop" to "Workshop & appointments",
    )
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(items) { (key, label) ->
            OutlinedCard(Modifier.fillMaxWidth().clickable {
                when (key) {
                    "docs" -> vm.refreshDocs()
                    "stations" -> vm.refreshStations()
                    "support" -> vm.refreshSupport()
                    "refer" -> vm.refreshReferral()
                    "workshop" -> vm.refreshService()
                }
                onOpen(key)
            }) { ListItem(headlineContent = { Text(label) }, trailingContent = { Icon(Icons.Default.ChevronRight, null) }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoreDetail(page: String, onBack: () -> Unit, onKyc: () -> Unit, onLogout: () -> Unit, onActiveRide: (String) -> Unit, vm: RiderAppViewModel) {
    Column {
        TopAppBar(title = { Text(page.replaceFirstChar { it.uppercase() }) }, navigationIcon = {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
        })
        when (page) {
            "profile" -> ProfileMore(vm, onLogout)
            "docs" -> DocsMore(vm, onKyc)
            "book" -> BookRideMore(onActiveRide)
            "stations" -> StationsMore(vm)
            "support" -> SupportMore(vm)
            "feedback" -> FeedbackMore(vm)
            "refer" -> ReferMore(vm)
            "workshop" -> WorkshopMore(vm)
        }
    }
}

@Composable
private fun WorkshopMore(vm: RiderAppViewModel) {
    val s = vm.state.collectAsState().value
    LaunchedEffect(Unit) { vm.refreshService() }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Book a workshop slot", fontWeight = FontWeight.SemiBold) }
        if (s.slots.filter { it.remaining > 0 }.isEmpty()) {
            item { EmptyState(Icons.Default.Build, "No slots open", "Check back later or contact support.") }
        }
        items(s.slots.filter { it.remaining > 0 }) { slot ->
            OutlinedCard(Modifier.clickable { vm.schedule(slot.centreId, slot.id) }) {
                ListItem(
                    headlineContent = { Text("${slot.date} · ${slot.startTime}") },
                    supportingContent = { Text("${slot.remaining} seats left") },
                )
            }
        }
        item { Text("Your appointments", fontWeight = FontWeight.SemiBold) }
        if (s.appointments.isEmpty()) item { Text("No appointments yet", style = MaterialTheme.typography.bodyMedium) }
        items(s.appointments) { a ->
            OutlinedCard {
                ListItem(
                    headlineContent = { Text(a.centreName ?: "Workshop") },
                    supportingContent = { Text(a.status) },
                    trailingContent = {
                        if (a.status != "Cancelled" && a.status != "Completed") {
                            TextButton(onClick = { vm.cancelAppt(a.id, "Rider cancelled from app") }) { Text("Cancel") }
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun ProfileMore(vm: RiderAppViewModel, onLogout: () -> Unit, profileVm: ProfileViewModel = hiltViewModel()) {
    val home = vm.state.collectAsState().value.home
    var name by remember { mutableStateOf(home?.rider?.fullName ?: "") }
    var email by remember { mutableStateOf(home?.rider?.email ?: "") }
    var address by remember { mutableStateOf(home?.rider?.address ?: "") }
    LaunchedEffect(Unit) { profileVm.load() }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(address, { address = it }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth()) }
        item { Text("Mobile: ${home?.rider?.phone ?: "—"}") }
        item { Text("KYC: ${home?.rider?.kycStatus ?: "—"}") }
        item { Button(onClick = { vm.saveProfile(name, email, address) }, modifier = Modifier.fillMaxWidth()) { Text("Save") } }
        item { Button(onClick = onLogout, colors = ButtonDefaults.buttonColors(MaterialTheme.colorScheme.error), modifier = Modifier.fillMaxWidth()) { Text("Logout") } }
    }
}

@Composable
private fun DocsMore(vm: RiderAppViewModel, onKyc: () -> Unit) {
    val docs = vm.state.collectAsState().value.agreements
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Button(onClick = onKyc, modifier = Modifier.fillMaxWidth()) { Text("Upload KYC (camera or file on next screen)") } }
        items(docs) { d -> InfoCard(d.type, d.status, d.content.take(120)) }
        if (docs.isEmpty()) item { EmptyState(Icons.Default.Description, "No agreements yet", "Admin can issue a rental agreement to your account.") }
    }
}

@Composable
private fun StationsMore(vm: RiderAppViewModel) {
    val stations = vm.state.collectAsState().value.stations
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (stations.isEmpty()) item { EmptyState(Icons.Default.EvStation, "No stations listed", "Admin can add charging stations in the portal.") }
        items(stations) { s -> InfoCard(s.name, s.address, "${s.chargerCount} chargers · ${s.status} · ${s.operatingHours ?: ""}") }
    }
}

@Composable
private fun SupportMore(vm: RiderAppViewModel) {
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    val tickets = vm.state.collectAsState().value.tickets
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Call Center / Command Center", fontWeight = FontWeight.SemiBold) }
        item { OutlinedTextField(subject, { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(body, { body = it }, label = { Text("Details") }, modifier = Modifier.fillMaxWidth()) }
        item { Button(onClick = { vm.createTicket(subject, body) }, modifier = Modifier.fillMaxWidth()) { Text("Send support request") } }
        items(tickets) { t -> InfoCard(t.subject, t.category, t.status) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedbackMore(vm: RiderAppViewModel) {
    var rating by remember { mutableIntStateOf(5) }
    var comment by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Vehicle") }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf("Vehicle", "Service", "App").forEach { c ->
            FilterChip(selected = category == c, onClick = { category = c }, label = { Text(c) })
        }
        Slider(value = rating.toFloat(), onValueChange = { rating = it.toInt() }, valueRange = 1f..5f, steps = 3)
        Text("Rating $rating / 5")
        OutlinedTextField(comment, { comment = it }, label = { Text("Comments") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { vm.sendFeedback(rating, comment, category) }, modifier = Modifier.fillMaxWidth(), enabled = comment.length >= 5) { Text("Submit feedback") }
    }
}

@Composable
private fun ReferMore(vm: RiderAppViewModel) {
    val ref = vm.state.collectAsState().value.referral
    var code by remember { mutableStateOf("") }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        InfoCard("Your code", ref?.code ?: "Assigned after first sign-in", "${ref?.referredCount ?: 0} successful referrals")
        Text("Share this code with friends. Rewards follow business rules configured by admin.")
        if (ref?.referredBy.isNullOrBlank()) {
            OutlinedTextField(code, { code = it }, label = { Text("Friend's referral code") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = { vm.applyReferral(code) }, modifier = Modifier.fillMaxWidth(), enabled = code.isNotBlank()) { Text("Apply code") }
        } else {
            Text("You were referred by an existing rider.")
        }
    }
}

@Composable
private fun StatMini(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier) { Column(Modifier.padding(16.dp)) { Text(label, style = MaterialTheme.typography.bodySmall); Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) } }
}

@Composable
private fun InfoCard(title: String, subtitle: String?, extra: String? = null) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            extra?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
