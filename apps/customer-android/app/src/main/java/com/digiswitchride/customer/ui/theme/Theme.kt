package com.digiswitchride.customer.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green = Color(0xFF16A34A)
private val GreenDark = Color(0xFF15803D)

private val LightColorScheme = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCFCE7),
    secondary = GreenDark,
)

@Composable
fun DigiSwitchrideTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LightColorScheme, content = content)
}
