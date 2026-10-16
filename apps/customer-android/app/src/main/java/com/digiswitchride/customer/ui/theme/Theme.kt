package com.digiswitchride.customer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = GreenPrimary,
    onPrimary = Color.White,
    primaryContainer = GreenLight,
    onPrimaryContainer = GreenDark,
    secondary = GreenDark,
    background = Color(0xFFF3F5FB),
    surface = Color.White,
    surfaceVariant = SurfaceCard,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    error = BatteryLow,
)

private val DarkColors = darkColorScheme(
    primary = AccentElectric,
    onPrimary = SurfaceDark,
    primaryContainer = GreenDark,
    onPrimaryContainer = GreenLight,
    secondary = GreenLight,
    background = SurfaceDark,
    surface = Color(0xFF1E293B),
    surfaceVariant = Color(0xFF334155),
    onSurface = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF94A3B8),
)

@Composable
fun DigiSwitchrideTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
