package com.digiswitchride.customer.ui.util

import kotlin.math.roundToInt

fun formatInr(amount: Double?): String {
    val value = amount ?: 0.0
    return "₹${value.roundToInt().toString().reversed().chunked(3).joinToString(",").reversed()}"
}
