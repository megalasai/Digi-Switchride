package com.digiswitchride.customer

import com.digiswitchride.customer.data.ApiSettings
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiSettingsTest {
    @Test
    fun normalizeBaseUrl_addsSchemeAndV1() {
        assertEquals("http://162.159.140.98:4000/api/v1", ApiSettings.normalizeBaseUrl("162.159.140.98:4000"))
        assertEquals("http://162.159.140.98:4000/api/v1", ApiSettings.normalizeBaseUrl("http://162.159.140.98:4000"))
    }
}
