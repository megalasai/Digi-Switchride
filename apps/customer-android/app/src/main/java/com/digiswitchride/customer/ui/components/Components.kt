package com.digiswitchride.customer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import coil.compose.AsyncImage
import com.digiswitchride.customer.R
import com.digiswitchride.customer.ui.theme.*

fun vehicleIcon(type: String?, wheelClass: String?): ImageVector {
    val cls = wheelClass ?: when (type) {
        "ERickshaw" -> "ThreeWheeler"
        "ECar" -> "FourWheeler"
        else -> "TwoWheeler"
    }
    return when (cls) {
        "ThreeWheeler" -> Icons.Default.ElectricRickshaw
        "FourWheeler" -> Icons.Default.DirectionsCar
        else -> Icons.Default.TwoWheeler
    }
}

@Composable
fun TenantLogo(url: String?, modifier: Modifier = Modifier, showLabel: Boolean = true) {
    Column(modifier) {
        if (showLabel) {
            Text(
                "FLEETEL",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(6.dp))
        }
        Surface(shape = RoundedCornerShape(12.dp), color = Color.White, shadowElevation = 1.dp) {
            if (url.isNullOrBlank()) {
                androidx.compose.foundation.Image(
                    painter = painterResource(R.drawable.fleetel_logo),
                    contentDescription = "Fleetel logo",
                    modifier = Modifier.height(48.dp).widthIn(max = 180.dp).padding(8.dp),
                    contentScale = ContentScale.Fit,
                )
            } else {
                AsyncImage(
                    model = url,
                    contentDescription = "Organization logo",
                    modifier = Modifier.height(48.dp).widthIn(max = 180.dp).padding(8.dp),
                    contentScale = ContentScale.Fit,
                )
            }
        }
    }
}

@Composable
fun BrandHeader(title: String, subtitle: String, logoUrl: String? = null) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(shape = RoundedCornerShape(16.dp), color = Color.White, shadowElevation = 2.dp) {
            if (logoUrl.isNullOrBlank()) {
                androidx.compose.foundation.Image(
                    painter = painterResource(R.drawable.fleetel_logo),
                    contentDescription = "Fleetel Switchride",
                    modifier = Modifier.height(72.dp).widthIn(min = 120.dp, max = 200.dp).padding(12.dp),
                    contentScale = ContentScale.Fit,
                )
            } else {
                AsyncImage(
                    model = logoUrl,
                    contentDescription = "Fleetel Switchride",
                    modifier = Modifier.height(72.dp).widthIn(min = 120.dp, max = 200.dp).padding(12.dp),
                    contentScale = ContentScale.Fit,
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, enabled: Boolean = true, loading: Boolean = false) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
    ) {
        if (loading) CircularProgressIndicator(modifier = Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
        else Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun HubCard(name: String, distanceKm: Double, available: Int, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (selected) 4.dp else 1.dp),
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                    .background(if (selected) MaterialTheme.colorScheme.primary else GreenLight),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.LocationOn, null, tint = if (selected) Color.White else GreenDark)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("%.1f km away".format(distanceKm), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Surface(shape = RoundedCornerShape(20.dp), color = GreenLight) {
                Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.TwoWheeler, null, Modifier.size(16.dp), tint = GreenDark)
                    Spacer(Modifier.width(4.dp))
                    Text("$available free", style = MaterialTheme.typography.labelMedium, color = GreenDark)
                }
            }
        }
    }
}

@Composable
fun VehicleCard(model: String, registration: String, battery: Int, canBook: Boolean, onBook: () -> Unit, type: String? = null, wheelClass: String? = null) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(vehicleIcon(type, wheelClass), null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(model, style = MaterialTheme.typography.titleLarge)
                    Text(registration, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                BatteryBadge(battery)
            }
            Spacer(Modifier.height(14.dp))
            PrimaryButton("Book & Ride", onClick = onBook, enabled = canBook)
            if (!canBook) {
                Spacer(Modifier.height(6.dp))
                Text("KYC approval required", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
fun BatteryBadge(percent: Int) {
    val color = when {
        percent >= 60 -> BatteryHigh
        percent >= 30 -> BatteryMid
        else -> BatteryLow
    }
    Surface(shape = RoundedCornerShape(20.dp), color = color.copy(alpha = 0.12f)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.BatteryFull, null, tint = color, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text("$percent%", style = MaterialTheme.typography.labelMedium, color = color)
        }
    }
}

@Composable
fun KycStepCard(icon: ImageVector, title: String, subtitle: String, done: Boolean, onUpload: () -> Unit) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onUpload),
        shape = RoundedCornerShape(16.dp),
        colors = if (done) CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer) else CardDefaults.outlinedCardColors(),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(if (done) "Marked uploaded" else subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(if (done) Icons.Default.CheckCircle else Icons.Default.ChevronRight, null, tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(80.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun StatusChip(label: String, color: Color) {
    Surface(shape = RoundedCornerShape(20.dp), color = color.copy(alpha = 0.12f)) {
        Text(label, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), style = MaterialTheme.typography.labelMedium, color = color)
    }
}
