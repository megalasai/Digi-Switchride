package com.digiswitchride.customer.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.digiswitchride.customer.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.apiSettingsStore by preferencesDataStore("api_settings")

@Singleton
class ApiSettings @Inject constructor(@ApplicationContext private val context: Context) {
    private val baseUrlKey = stringPreferencesKey("base_url")
    private val tenantSlugKey = stringPreferencesKey("tenant_slug")

    suspend fun getBaseUrl(): String {
        val override = context.apiSettingsStore.data.map { it[baseUrlKey] }.first()
        return normalizeBaseUrl(override ?: BuildConfig.API_BASE_URL)
    }

    suspend fun setBaseUrl(input: String) {
        val normalized = normalizeBaseUrl(input)
        context.apiSettingsStore.edit { it[baseUrlKey] = normalized }
    }

    suspend fun getTenantSlug(): String {
        return context.apiSettingsStore.data.map { it[tenantSlugKey] }.first() ?: "digi-switchride"
    }

    suspend fun setTenantSlug(slug: String) {
        val value = slug.trim().lowercase().ifBlank { "digi-switchride" }
        context.apiSettingsStore.edit { it[tenantSlugKey] = value }
    }

    suspend fun getDisplayHost(): String {
        val url = getBaseUrl()
        return url.removePrefix("http://").removePrefix("https://").removeSuffix("/api/v1").removeSuffix("/")
    }

    companion object {
        fun normalizeBaseUrl(input: String): String {
            val trimmed = input.trim().trimEnd('/')
            if (trimmed.isEmpty()) return BuildConfig.API_BASE_URL

            val withScheme = when {
                trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
                else -> "http://$trimmed"
            }

            return when {
                withScheme.endsWith("/api/v1") -> withScheme
                withScheme.endsWith("/api") -> "$withScheme/v1"
                else -> "$withScheme/api/v1"
            }
        }
    }
}
