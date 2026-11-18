package com.axzydev.checklab.core.network

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import kotlinx.serialization.Serializable

@Serializable
data class ApiHealth(val version: String? = null, val commit: String? = null)

/** `GET /health`: público, trae la versión y el commit del API. */
class SystemApi(private val client: HttpClient) {
    suspend fun health(): ApiHealth = apiCall { client.get("health") }
}
