package com.axzydev.checklab.nom

import com.axzydev.checklab.people.PeopleApi
import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.bodyJson
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import io.ktor.http.HttpMethod
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Claves de `RemotePunchDto` (`.strict()`; todas `optional`, ninguna `nullable`). */
private val REMOTE_PUNCH_KEYS = setOf(
    "type", "workMode", "clientEventId", "clientReportedAt", "latitude", "longitude", "gpsAccuracyMeters", "note",
)

class NomApiTest {
    private val api = MockApi { request ->
        when (request.route) {
            "nom/me/punch" -> ok("""{"created":true,"punch":{"id":"p1","type":"ENTRY","occurredAt":"2026-11-08T15:00:00.000Z"}}""")
            "nom/me/telework" -> ok("""{"registration":null,"remotePunchEnabled":true,"remoteGeolocationEnabled":false}""")
            else -> ok("[]")
        }
    }

    @Test
    fun unaChecadaSinUbicacionNiNotaNoMandaNulos() = runTest {
        val result = NomApi(api.client).punch(
            PunchRequest(PunchType.ENTRY, WorkMode.REMOTO, clientEventId = "6f1c2c1e-6a0b-4b8a-9d55-3c2f1f8e0a11", clientReportedAt = "2026-11-08T15:00:00Z"),
        )
        val body = api.last.bodyJson()
        assertEquals(HttpMethod.Post, api.last.method)
        assertTrue(REMOTE_PUNCH_KEYS.containsAll(body.keys), "claves de más: ${body.keys - REMOTE_PUNCH_KEYS}")
        assertFalse(body.values.any { it == JsonNull }, "el DTO no acepta null: $body")
        assertEquals(setOf("type", "workMode", "clientEventId", "clientReportedAt"), body.keys)
        assertEquals(JsonPrimitive("ENTRY"), body["type"])
        assertTrue(result.created)
    }

    @Test
    fun conUbicacionMandaCoordenadasYPrecision() = runTest {
        NomApi(api.client).punch(PunchRequest(PunchType.EXIT, latitude = 19.4954, longitude = -99.1451, gpsAccuracyMeters = 5.0))
        val body = api.last.bodyJson()
        assertEquals(JsonPrimitive(19.4954), body["latitude"])
        assertEquals(JsonPrimitive(5.0), body["gpsAccuracyMeters"])
    }

    @Test
    fun leeSiElClienteApagoLaUbicacion() = runTest {
        assertFalse(NomApi(api.client).punchSettings().remoteGeolocationEnabled)
    }

    @Test
    fun misMarcajesMandanElRangoComoQuery() = runTest {
        NomApi(api.client).myPunches(from = "2026-10-25", to = "2026-11-08")
        assertEquals("nom/me/punches", api.last.route)
        assertEquals("2026-10-25", api.last.url.parameters["from"])
        assertEquals("2026-11-08", api.last.url.parameters["to"])
    }
}

class PeopleApiTest {
    private val api = MockApi { ok("""{"data":[{"id":"u1","username":"karla.nunez","name":"Karla Núñez Ortega","role":"CLIENT_STAFF","active":true,
        "department":{"id":"d1","name":"Oficina"},"curp":"no lo usa la app"}],"total":1}""") }

    @Test
    fun laBusquedaVaEnFiltersDelQueryDeTabla() = runTest {
        val page = PeopleApi(api.client).people("  karla ", active = true)
        val body = api.last.bodyJson()
        assertEquals("users/query", api.last.route)
        assertEquals(JsonPrimitive(1), body["page"])
        val filters = body["filters"]!!.jsonObject
        assertEquals(JsonPrimitive("karla"), filters["name"])
        assertEquals(JsonPrimitive(true), filters["active"])
        assertEquals("Oficina", page.data.single().department?.name)
    }

    @Test
    fun sinBusquedaNiEstadoNoMandaFiltros() = runTest {
        PeopleApi(api.client).people("", active = null)
        assertEquals(null, api.last.bodyJson()["filters"], "filters es opcional en el DTO de tabla")
    }
}
