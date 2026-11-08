package com.axzydev.checklab.nom

import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.network.ApiJson
import com.axzydev.checklab.core.storage.SecureStore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.builtins.ListSerializer
import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/** Resultado de intentar una checada desde el teléfono. */
sealed interface PunchOutcome {
    /** El servidor la registró (o ya la tenía por el mismo `clientEventId`). */
    data class Sent(val punch: RemotePunch) : PunchOutcome
    /** Sin red: quedó en la cola cifrada y se manda sola al volver la conexión. */
    data class Queued(val pending: Int) : PunchOutcome
}

/**
 * Cola de checadas sin red, cifrada en el [SecureStore]. Cada checada lleva un
 * `clientEventId` (UUID) desde que se crea: el API la registra una sola vez
 * aunque se reintente, y `clientReportedAt` guarda la hora del teléfono.
 * Solo una falla de red la deja en cola; un rechazo del API se devuelve tal cual.
 * La cola es por persona: si otra cuenta entra en el mismo teléfono no manda
 * checadas ajenas con su sesión.
 */
class PunchQueue(private val store: SecureStore, private val api: NomApi, userId: String) {
    private val lock = Mutex()
    private val key = "nom.punchQueue.$userId"

    fun pending(): List<PunchRequest> =
        store.get(key)?.let { runCatching { ApiJson.decodeFromString(ListSerializer(PunchRequest.serializer()), it) }.getOrNull() }
            ?: emptyList()

    private fun save(list: List<PunchRequest>) {
        if (list.isEmpty()) store.remove(key) else store.put(key, ApiJson.encodeToString(ListSerializer(PunchRequest.serializer()), list))
    }

    @OptIn(ExperimentalUuidApi::class)
    suspend fun punch(request: PunchRequest): PunchOutcome = lock.withLock {
        val stamped = request.copy(
            clientEventId = request.clientEventId ?: Uuid.random().toString(),
            clientReportedAt = request.clientReportedAt ?: Clock.System.now().toString(),
        )
        // Lo que quedó pendiente va primero: el orden de la jornada importa.
        flushLocked()
        if (pending().isNotEmpty()) {
            save(pending() + stamped)
            return@withLock PunchOutcome.Queued(pending().size)
        }
        try {
            PunchOutcome.Sent(api.punch(stamped).punch)
        } catch (e: ApiException) {
            if (!e.isNetwork) throw e
            save(pending() + stamped)
            PunchOutcome.Queued(pending().size)
        }
    }

    /** Manda lo pendiente en orden. Se detiene en la primera falla de red; un rechazo del API se descarta y se informa. */
    suspend fun flush(): List<ApiException> = lock.withLock { flushLocked() }

    private suspend fun flushLocked(): List<ApiException> {
        val rejected = mutableListOf<ApiException>()
        var queue = pending()
        while (queue.isNotEmpty()) {
            try {
                api.punch(queue.first())
            } catch (e: ApiException) {
                if (e.isNetwork) break
                rejected += e
            }
            queue = queue.drop(1)
            save(queue)
        }
        return rejected
    }
}
