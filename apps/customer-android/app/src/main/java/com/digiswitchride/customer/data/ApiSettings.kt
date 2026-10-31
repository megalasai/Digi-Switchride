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
    private val tenantSlugKey = stringPreferencesKey("tenant_slug")

    /** Production API host is fixed at build time (`API_BASE_URL` in gradle.properties). */
    fun apiBaseUrl(): String = BuildConfig.API_BASE_URL

    suspend fun getTenantSlug(): String {
        return context.apiSettingsStore.data.map { it[tenantSlugKey] }.first()
            ?: BuildConfig.DEFAULT_TENANT_SLUG
    }

    suspend fun setTenantSlug(slug: String) {
        val value = slug.trim().lowercase().ifBlank { BuildConfig.DEFAULT_TENANT_SLUG }
        context.apiSettingsStore.edit { it[tenantSlugKey] = value }
    }

    fun brandingLogoUrl(tenantSlug: String): String {
        val base = apiBaseUrl().trimEnd('/')
        val slug = tenantSlug.trim().lowercase()
        return if (slug.isEmpty()) "$base/branding/optional-logo"
        else "$base/branding/optional-logo?slug=${java.net.URLEncoder.encode(slug, Charsets.UTF_8.name())}"
    }
}
