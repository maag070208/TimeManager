package com.axzydev.checklab.core.network

import kotlinx.serialization.Serializable

/**
 * Error del API con el contrato `{ error, code, message }`. `status = 0` es
 * falla de red (sin respuesta del servidor).
 */
class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
) : Exception(message) {
    val isNetwork: Boolean get() = status == 0
    val isUnauthorized: Boolean get() = status == 401

    companion object {
        const val NETWORK = "NETWORK"
        const val NO_SERVER = "NO_SERVER"
    }
}

@Serializable
internal data class ApiErrorBody(
    val code: String? = null,
    val message: String? = null,
)
