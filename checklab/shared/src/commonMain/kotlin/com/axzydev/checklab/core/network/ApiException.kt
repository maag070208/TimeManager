package com.axzydev.checklab.core.network

import kotlinx.serialization.Serializable

/**
 * Error del API con el contrato `{ error, code, message, supportCode? }`.
 * `status = 0` es falla de red (sin respuesta del servidor). [message] siempre
 * se puede mostrar: o es el texto del API o uno de [SupportCode].
 */
class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
    val supportCode: String? = null,
) : Exception(message) {
    val isNetwork: Boolean get() = status == 0
    val isUnauthorized: Boolean get() = status == 401

    companion object {
        const val NETWORK = "NETWORK"
        const val NO_SERVER = "NO_SERVER"
        const val UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE"
    }
}

/**
 * Códigos de soporte que pone la app cuando el API no pudo contestar (los
 * AX-01…AX-06 los manda el API). Diccionario: `docs/CODIGOS_DE_ERROR.md`.
 */
object SupportCode {
    const val NO_CONNECTION = "AX-10"
    const val TIMEOUT = "AX-11"
    const val UNAVAILABLE = "AX-12"
    const val UNEXPECTED = "AX-13"

    fun message(code: String): String = "[$code] " + when (code) {
        NO_CONNECTION -> "No hay conexión con CheckLab. Revisa tu internet e intenta de nuevo; si sigue pasando, comparte este código con soporte."
        TIMEOUT -> "CheckLab tardó demasiado en responder. Intenta de nuevo; si sigue pasando, comparte este código con soporte."
        UNAVAILABLE -> "CheckLab no está disponible en este momento. Intenta de nuevo en unos minutos; si sigue pasando, comparte este código con soporte."
        else -> "Algo salió mal al leer la respuesta. Intenta de nuevo; si sigue pasando, comparte este código con soporte."
    }
}

@Serializable
internal data class ApiErrorBody(
    val code: String? = null,
    val message: String? = null,
    val supportCode: String? = null,
)
