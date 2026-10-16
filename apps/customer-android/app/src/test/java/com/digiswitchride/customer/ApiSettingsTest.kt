package com.digiswitchride.customer

import com.digiswitchride.customer.data.ApiSettings
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiSettingsTest {
    @Test
    fun normalizeBaseUrl_addsSchemeAndV1() {
        assertEquals("http://10.0.2.2:4000/api/v1", ApiSettings.normalizeBaseUrl("10.0.2.2:4000"))
        assertEquals("http://192.168.0.5:4000/api/v1", ApiSettings.normalizeBaseUrl("http://192.168.0.5:4000"))
    }
}
