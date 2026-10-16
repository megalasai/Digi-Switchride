package com.digiswitchride.customer.di

import com.digiswitchride.customer.BuildConfig
import com.digiswitchride.customer.data.ApiSettings
import com.digiswitchride.customer.data.TokenManager
import com.digiswitchride.customer.data.api.SwitchrideApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenManager: TokenManager, apiSettings: ApiSettings): OkHttpClient {
        val baseUrlInterceptor = Interceptor { chain ->
            val request = chain.request()
            val configuredBase = runBlocking { apiSettings.getBaseUrl() }.toHttpUrlOrNull()
                ?: BuildConfig.API_BASE_URL.toHttpUrlOrNull()
                ?: throw IllegalStateException("Invalid API base URL")

            val path = request.url.encodedPath
            val suffix = when {
                path.contains("/api/v1") -> path.substringAfter("/api/v1").ifEmpty { "/" }
                else -> path
            }

            val newUrl = configuredBase.newBuilder()
                .encodedPath(configuredBase.encodedPath.trimEnd('/') + suffix)
                .query(request.url.query)
                .build()

            chain.proceed(request.newBuilder().url(newUrl).build())
        }

        val authInterceptor = Interceptor { chain ->
            val token = runBlocking { tokenManager.getAccessToken() }
            val tenantSlug = runBlocking { apiSettings.getTenantSlug() }
            val builder = chain.request().newBuilder()
            if (token != null) builder.addHeader("Authorization", "Bearer $token")
            if (tenantSlug.isNotBlank()) builder.addHeader("X-Tenant-Slug", tenantSlug)
            chain.proceed(builder.build())
        }

        return OkHttpClient.Builder()
            .addInterceptor(baseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun provideApi(retrofit: Retrofit): SwitchrideApi = retrofit.create(SwitchrideApi::class.java)
}
