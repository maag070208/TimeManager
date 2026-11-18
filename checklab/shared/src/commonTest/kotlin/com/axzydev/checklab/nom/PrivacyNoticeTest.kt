package com.axzydev.checklab.nom

import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.bodyJson
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import io.ktor.http.HttpMethod
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PrivacyNoticeTest {
    private val api = MockApi { request ->
        when (request.route) {
            "nom/me/privacy" -> ok("""{"notice":"Aviso de Acme","version":3,"accepted":false,"acceptedAt":null}""")
            "nom/me/privacy/accept" -> ok("""{"notice":"Aviso de Acme","version":3,"accepted":true,"acceptedAt":"2026-11-18T15:00:00.000Z"}""")
            else -> ok("{}")
        }
    }

    @Test
    fun leeElAvisoPendiente() = runTest {
        val privacy = WorkerApi(api.client).myPrivacy()
        assertEquals(3, privacy.version)
        assertTrue(privacy.pending)
        assertNull(privacy.acceptedAt)
    }

    // PrivacyAcceptDto (strict): { version }
    @Test
    fun aceptarMandaSoloLaVersionLeida() = runTest {
        val privacy = WorkerApi(api.client).acceptPrivacy(3)
        assertEquals(HttpMethod.Post, api.last.method)
        assertEquals("nom/me/privacy/accept", api.last.route)
        assertEquals(setOf("version"), api.last.bodyJson().keys)
        assertEquals(JsonPrimitive(3), api.last.bodyJson()["version"])
        assertFalse(privacy.pending)
    }

    @Test
    fun sinAvisoPublicadoNoHayNadaQueAceptar() {
        assertFalse(MyPrivacyNotice(notice = null).pending)
        assertFalse(MyPrivacyNotice(notice = "  ").pending)
    }

    @Test
    fun sinAvisoAceptadoNoSePideUbicacion() {
        val pending = MyWorkdayState(privacy = MyPrivacyNotice(notice = "Aviso", version = 2, accepted = false))
        assertTrue(pending.privacyPending)
        assertFalse(pending.asksLocation)

        val accepted = pending.copy(privacy = MyPrivacyNotice(notice = "Aviso", version = 2, accepted = true))
        assertTrue(accepted.asksLocation)
        assertFalse(accepted.copy(shareLocation = false).asksLocation)
        assertFalse(accepted.copy(geoEnabled = false).asksLocation)
        assertTrue(MyWorkdayState(privacy = null).asksLocation, "sin respuesta del API se comporta como antes")
    }
}
