package com.digiswitchride.customer.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import retrofit2.HttpException

object ApiErrorParser {
    private val gson = Gson()

    fun message(e: Exception): String {
        if (e is HttpException) {
            val body = e.response()?.errorBody()?.string()
            if (!body.isNullOrBlank()) {
                runCatching {
                    val json = gson.fromJson(body, JsonObject::class.java)
                    when {
                        json.has("message") && json.get("message").isJsonArray ->
                            json.getAsJsonArray("message").joinToString(", ") { it.asString }
                        json.has("message") -> json.get("message").asString
                        else -> body
                    }
                }.getOrNull()?.let { return it }
            }
            return when (e.code()) {
                401 -> "Session expired. Please sign in again."
                403 -> "You do not have permission for this action."
                404 -> "Resource not found."
                else -> "Server error (${e.code()})"
            }
        }
        return e.message ?: "Request failed"
    }
}
