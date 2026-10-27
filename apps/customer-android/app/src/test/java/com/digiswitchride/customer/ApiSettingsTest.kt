package com.digiswitchride.customer

import com.digiswitchride.customer.data.ApiSettings
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiSettingsTest {
    @Test
    fun normalizeBaseUrl_addsSchemeAndV1() {
        assertEquals("https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1", ApiSettings.normalizeBaseUrl("https://fleetel-switchride-pmxt5.ondigitalocean.app/api"))
        assertEquals("https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1", ApiSettings.normalizeBaseUrl("https://fleetel-switchride-pmxt5.ondigitalocean.app"))
    }
}
