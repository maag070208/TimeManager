package com.axzydev.checklab.auth

import com.axzydev.checklab.core.network.apiCall
import com.axzydev.checklab.core.network.apiCallUnit
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody

class AuthApi(private val client: HttpClient) {
    suspend fun branding(slug: String): Branding =
        apiCall { client.get("auth/branding") { parameter("tenant", slug) } }

    suspend fun login(request: LoginRequest): LoginResponse =
        apiCall { client.post("auth/login") { setBody(request) } }

    suspend fun refresh(refreshToken: String): RefreshResponse =
        apiCall { client.post("auth/refresh") { setBody(RefreshRequest(refreshToken)) } }

    suspend fun me(): Me = apiCall { client.get("auth/me") }

    suspend fun changePassword(currentPassword: String, newPassword: String) =
        apiCallUnit { client.post("auth/change-password") { setBody(ChangePasswordRequest(currentPassword, newPassword)) } }
}
