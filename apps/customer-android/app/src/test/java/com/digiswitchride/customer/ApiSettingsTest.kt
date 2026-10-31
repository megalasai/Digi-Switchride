package com.digiswitchride.customer

import org.junit.Assert.assertTrue
import org.junit.Test

class ApiSettingsTest {
    @Test
    fun productionApiHost_isDigitalOcean() {
        assertTrue(BuildConfig.API_BASE_URL.startsWith("https://fleetel-switchride-pmxt5.ondigitalocean.app"))
        assertTrue(BuildConfig.API_BASE_URL.endsWith("/api/v1"))
    }
}
