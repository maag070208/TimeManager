package com.axzydev.checklab.auth

import kotlinx.serialization.Serializable

/** Contrato de `api/src/modules/auth/models/dto/auth.dto.ts`. */
@Serializable
data class LoginRequest(val username: String, val password: String, val tenant: String? = null)

@Serializable
data class LoginResponse(val token: String, val refreshToken: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class RefreshResponse(val token: String, val refreshToken: String)

@Serializable
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)

/** `GET /auth/branding?tenant=<slug>`: `name == null` si el cliente no existe. */
@Serializable
data class Branding(
    val slug: String? = null,
    val name: String? = null,
    val brandColor: String? = null,
)

@Serializable
data class TenantInfo(
    val id: String,
    val slug: String,
    val name: String,
    val timezone: String,
    val weekStartDay: Int = 1,
    val disabledModules: List<String> = emptyList(),
    val brandColor: String? = null,
)

@Serializable
data class Department(val id: String, val name: String)

/** `GET /auth/me`: la sesión con permisos efectivos (solo los distintos de NONE). */
@Serializable
data class Me(
    val id: String,
    val username: String,
    val name: String,
    val email: String? = null,
    val role: String,
    val roles: List<String> = emptyList(),
    val mustChangePassword: Boolean = false,
    val employeeNumber: String? = null,
    val jobTitle: String? = null,
    val department: Department? = null,
    val tenant: TenantInfo? = null,
    val photoUrl: String? = null,
    val permissions: Map<String, PermissionScope> = emptyMap(),
    val language: String = "es",
) {
    val isPlatform: Boolean get() = tenant == null
    val firstName: String get() = name.substringBefore(' ')

    fun can(permission: String): Boolean = permissions.containsKey(permission)
    fun scope(permission: String): PermissionScope = permissions[permission] ?: PermissionScope.NONE
}

@Serializable
enum class PermissionScope { NONE, OWN, AREA, ALL }
