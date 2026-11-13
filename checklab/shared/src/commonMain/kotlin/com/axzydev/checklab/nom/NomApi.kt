package com.axzydev.checklab.nom

import com.axzydev.checklab.core.network.apiCall
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable

@Serializable
enum class PunchType { ENTRY, LUNCH_START, LUNCH_END, EXIT }

@Serializable
enum class WorkMode { PRESENCIAL, HIBRIDO, REMOTO, CAMPO }

/** `GET /nom/me/punches`: reloj, acceso y checada web juntos, del más reciente al más viejo. */
@Serializable
data class MyPunch(
    val id: String,
    val source: String,
    val type: PunchType? = null,
    val occurredAt: String,
    val method: String? = null,
    val clockSerial: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** `RemotePunchDto` del API (`api/src/modules/nom/models/dto`). */
@Serializable
data class PunchRequest(
    val type: PunchType,
    val workMode: WorkMode? = null,
    val clientEventId: String? = null,
    val clientReportedAt: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val gpsAccuracyMeters: Double? = null,
    val note: String? = null,
)

@Serializable
data class PunchResult(val created: Boolean, val punch: RemotePunch)

@Serializable
data class RemotePunch(val id: String, val type: PunchType, val occurredAt: String)

@Serializable
data class DiscrepancyRequest(val punchId: String, val reason: String)

@Serializable
data class IdResult(val id: String)

/**
 * Lo que la checada necesita de `GET /nom/me/telework`: los canales de checada
 * que contrató el cliente, si esta app puede checar (canal APP), si se guarda
 * ubicación y si hay comida.
 *
 * `canPunchWeb`, `canPunchApp` y `punchChannels` son del contrato nuevo; en un
 * API anterior llegan ausentes y se cae a `canPunchRemote` (comportamiento previo).
 */
@Serializable
data class PunchSettings(
    val canPunchRemote: Boolean = true,
    val canPunchWeb: Boolean? = null,
    val canPunchApp: Boolean? = null,
    val punchChannels: List<String> = emptyList(),
    val remoteGeolocationEnabled: Boolean = true,
    val lunchPunchEnabled: Boolean = true,
    /** El cliente exige el acuerdo de método y la persona aún no lo acepta: el API rechaza la checada. */
    val remoteAgreementPending: Boolean = false,
) {
    /**
     * Si esta app puede registrar checadas: manda el canal APP, no `canPunchRemote`
     * (que solo dice que hay algún canal remoto, la web incluida). Sin `canPunchApp`
     * se deduce de los canales; sin canales (API anterior), de `canPunchRemote`.
     */
    val canPunchFromApp: Boolean
        get() = canPunchApp
            ?: if (punchChannels.isNotEmpty()) canPunchRemote && "APP" in punchChannels else canPunchRemote
}

class NomApi(private val client: HttpClient) {
    suspend fun myPunches(from: String? = null, to: String? = null, limit: Int? = null): List<MyPunch> =
        apiCall {
            client.get("nom/me/punches") {
                from?.let { parameter("from", it) }
                to?.let { parameter("to", it) }
                limit?.let { parameter("limit", it) }
            }
        }

    /**
     * La app siempre se identifica como canal APP (`X-Punch-Source`): el API la
     * rechaza con 403 `PUNCH_CHANNEL_DISABLED` si el cliente no contrató APP.
     * Va aquí, no en el ViewModel, para que la cola sin red también lo mande.
     */
    suspend fun punch(request: PunchRequest): PunchResult = apiCall {
        client.post("nom/me/punch") {
            header("X-Punch-Source", "APP")
            setBody(request)
        }
    }

    suspend fun punchSettings(): PunchSettings = apiCall { client.get("nom/me/telework") }

    suspend fun reportDiscrepancy(punchId: String, reason: String): IdResult =
        apiCall { client.post("nom/me/discrepancies") { setBody(DiscrepancyRequest(punchId, reason)) } }
}

/**
 * Siguiente checada permitida, la misma regla que el API (`remote-punch.service`)
 * y la web: entrada → salida a comer o salida → regreso → salida, una sola vez
 * por día. Tras la salida ya no hay paso: la lista queda vacía. Recibe los tipos
 * de hoy en orden cronológico. Con la comida apagada por el cliente el día es
 * entrada → salida (quien ya había salido a comer puede regresar o salir).
 */
fun nextPunchTypes(todayTypes: List<PunchType>, lunchEnabled: Boolean = true): List<PunchType> = when (todayTypes.lastOrNull()) {
    null -> listOf(PunchType.ENTRY)
    PunchType.ENTRY -> if (lunchEnabled) listOf(PunchType.LUNCH_START, PunchType.EXIT) else listOf(PunchType.EXIT)
    PunchType.LUNCH_START -> if (lunchEnabled) listOf(PunchType.LUNCH_END) else listOf(PunchType.LUNCH_END, PunchType.EXIT)
    PunchType.LUNCH_END -> listOf(PunchType.EXIT)
    PunchType.EXIT -> emptyList()
}

val PunchType.label: String
    get() = when (this) {
        PunchType.ENTRY -> "Entrada"
        PunchType.LUNCH_START -> "Salida a comer"
        PunchType.LUNCH_END -> "Regreso de comer"
        PunchType.EXIT -> "Salida"
    }

/** Texto del botón principal, como en la web ("Registrar entrada", "Salida a comer"). */
val PunchType.action: String
    get() = when (this) {
        PunchType.ENTRY -> "Registrar entrada"
        PunchType.EXIT -> "Registrar salida"
        else -> label
    }

val WorkMode.label: String
    get() = when (this) {
        WorkMode.PRESENCIAL -> "Presencial"
        WorkMode.HIBRIDO -> "Híbrido"
        WorkMode.REMOTO -> "Remoto"
        WorkMode.CAMPO -> "Campo"
    }

fun sourceLabel(source: String): String = when (source) {
    "CLOCK" -> "Reloj"
    "ACCESS" -> "Acceso"
    "REMOTE" -> "App/Web"
    else -> source
}
