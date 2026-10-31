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
        val authInterceptor = Interceptor { chain ->
            val token = runBlocking { tokenManager.getAccessToken() }
            val tenantSlug = runBlocking { apiSettings.getTenantSlug() }
            val builder = chain.request().newBuilder()
            if (token != null) builder.addHeader("Authorization", "Bearer $token")
            if (tenantSlug.isNotBlank()) builder.addHeader("X-Tenant-Slug", tenantSlug)
            chain.proceed(builder.build())
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
                },
            )
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun provideApi(retrofit: Retrofit): SwitchrideApi = retrofit.create(SwitchrideApi::class.java)
}
