package com.axzydev.checklab.nom

import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.network.TokenProvider
import com.axzydev.checklab.core.network.createHttpClient
import com.axzydev.checklab.core.storage.InMemorySecureStore
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertTrue

private val json = headersOf(HttpHeaders.ContentType, "application/json")
private fun HttpRequestData.bodyText() = (body as? OutgoingContent.ByteArrayContent)?.bytes()?.decodeToString().orEmpty()

private object NoTokens : TokenProvider {
    override fun accessToken(): String? = "T"
    override suspend fun refresh(): String? = null
    override suspend fun onSessionExpired() = Unit
}

private class Server {
    var online = true
    val received = mutableListOf<String>()
    val sources = mutableListOf<String?>()
    val api = NomApi(
        createHttpClient("http://api.test/api/v1", NoTokens, MockEngine { request ->
            if (!online) throw IllegalStateException("sin red")
            sources += request.headers["X-Punch-Source"]
            val body = request.bodyText()
            received += body
            if (body.contains("\"type\":\"LUNCH_END\"") && received.none { it.contains("LUNCH_START") }) {
                respond("""{"code":"INVALID_PUNCH_SEQUENCE","message":"Secuencia inválida"}""", HttpStatusCode.Conflict, json)
            } else {
                val type = Regex("\"type\":\"(\\w+)\"").find(body)!!.groupValues[1]
                respond("""{"created":true,"punch":{"id":"p${received.size}","type":"$type","occurredAt":"2026-11-07T18:00:00Z"}}""", HttpStatusCode.OK, json)
            }
        }),
    )
}

class NextPunchTest {
    @Test
    fun laSecuenciaEsLaMismaQueLaDelApi() {
        assertEquals(listOf(PunchType.ENTRY), nextPunchTypes(emptyList()))
        assertEquals(listOf(PunchType.LUNCH_START, PunchType.EXIT), nextPunchTypes(listOf(PunchType.ENTRY)))
        assertEquals(listOf(PunchType.LUNCH_END), nextPunchTypes(listOf(PunchType.ENTRY, PunchType.LUNCH_START)))
        assertEquals(listOf(PunchType.EXIT), nextPunchTypes(listOf(PunchType.ENTRY, PunchType.LUNCH_START, PunchType.LUNCH_END)))
        assertEquals(emptyList(), nextPunchTypes(listOf(PunchType.ENTRY, PunchType.EXIT)))
        assertEquals(listOf(PunchType.EXIT), nextPunchTypes(listOf(PunchType.ENTRY), lunchEnabled = false))
        assertEquals(listOf(PunchType.LUNCH_END, PunchType.EXIT), nextPunchTypes(listOf(PunchType.ENTRY, PunchType.LUNCH_START), lunchEnabled = false))
        assertEquals(emptyList(), nextPunchTypes(listOf(PunchType.ENTRY, PunchType.LUNCH_START, PunchType.LUNCH_END, PunchType.EXIT)))
    }

    @Test
    fun sinRedTampocoSePuedeChecarDespuesDeLaSalida() {
        val queued = listOf(PunchType.ENTRY, PunchType.EXIT).map { PunchRequest(it) }
        assertEquals(emptyList(), MyWorkdayState(pending = queued).next)
    }
}

class PunchQueueTest {
    @Test
    fun conRedSeEnviaConIdDeEventoYHoraDelTelefono() = runTest {
        val server = Server()
        val queue = PunchQueue(InMemorySecureStore(), server.api, "u1")
        val outcome = queue.punch(PunchRequest(PunchType.ENTRY, latitude = 19.49, longitude = -99.14, gpsAccuracyMeters = 12.0))

        assertIs<PunchOutcome.Sent>(outcome)
        assertEquals("APP", server.sources.single(), "con red la checada también se identifica como APP")
        val body = server.received.single()
        assertTrue(Regex("\"clientEventId\":\"[0-9a-f-]{36}\"").containsMatchIn(body))
        assertTrue(body.contains("\"clientReportedAt\""))
        assertTrue(body.contains("\"latitude\":19.49"))
    }

    @Test
    fun sinRedSeGuardaYSeMandaEnOrdenAlVolver() = runTest {
        val server = Server().apply { online = false }
        val store = InMemorySecureStore()
        val queue = PunchQueue(store, server.api, "u1")

        assertIs<PunchOutcome.Queued>(queue.punch(PunchRequest(PunchType.ENTRY)))
        assertEquals(2, (queue.punch(PunchRequest(PunchType.LUNCH_START)) as PunchOutcome.Queued).pending)
        assertTrue(server.received.isEmpty())

        // Persiste: otra instancia (la app reabierta) ve la misma cola.
        val reopened = PunchQueue(store, server.api, "u1")
        assertEquals(listOf(PunchType.ENTRY, PunchType.LUNCH_START), reopened.pending().map { it.type })

        server.online = true
        assertTrue(reopened.flush().isEmpty())
        assertEquals(listOf<String?>("APP", "APP"), server.sources, "la cola sin red también manda X-Punch-Source: APP")
        assertEquals(listOf("ENTRY", "LUNCH_START"), server.received.map { Regex("\"type\":\"(\\w+)\"").find(it)!!.groupValues[1] })
        assertTrue(reopened.pending().isEmpty())
    }

    @Test
    fun reintentarUsaElMismoIdDeEvento() = runTest {
        val server = Server().apply { online = false }
        val queue = PunchQueue(InMemorySecureStore(), server.api, "u1")
        queue.punch(PunchRequest(PunchType.ENTRY))
        val id = queue.pending().single().clientEventId
        server.online = true
        queue.flush()
        assertTrue(server.received.single().contains("\"clientEventId\":\"$id\""))
    }

    @Test
    fun laColaEsPorPersona() = runTest {
        val server = Server().apply { online = false }
        val store = InMemorySecureStore()
        PunchQueue(store, server.api, "karla").punch(PunchRequest(PunchType.ENTRY))
        assertTrue(PunchQueue(store, server.api, "ricardo").pending().isEmpty())
    }

    @Test
    fun unRechazoDelApiNoSeEncolaYSeInforma() = runTest {
        val server = Server()
        val queue = PunchQueue(InMemorySecureStore(), server.api, "u1")
        val error = assertFailsWith<ApiException> { queue.punch(PunchRequest(PunchType.LUNCH_END)) }
        assertEquals("INVALID_PUNCH_SEQUENCE", error.code)
        assertTrue(queue.pending().isEmpty())
    }
}
