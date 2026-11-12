package com.axzydev.checklab.auth

import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.network.createHttpClient
import com.axzydev.checklab.core.storage.InMemorySecureStore
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val ME_STAFF = """{"id":"u1","username":"karla.nunez","name":"Karla Núñez Ortega","role":"CLIENT_STAFF",
"roles":["CLIENT_STAFF"],"mustChangePassword":false,"tenant":{"id":"t1","slug":"altamira","name":"Grupo Logístico Altamira",
"timezone":"America/Mexico_City","weekStartDay":3,"disabledModules":[],"punchChannels":["WEB","APP"]},"permissions":{"attendance.view":"OWN"},"language":"es",
"extraField":"se ignora"}"""

private const val ME_PROVISIONAL = """{"id":"u2","username":"nuevo","name":"Nuevo Usuario","role":"CLIENT_ADMIN",
"mustChangePassword":true,"tenant":{"id":"t1","slug":"acme","name":"Acme","timezone":"America/Mexico_City"},"permissions":{}}"""

private const val ME_PLATFORM = """{"id":"u3","username":"demo.admin","name":"Demo Admin","role":"ADMIN","tenant":null,
"permissions":{"tenants.view":"ALL"}}"""

private val json = headersOf(HttpHeaders.ContentType, "application/json")

private fun MockRequestHandleScope.ok(body: String) = respond(body, HttpStatusCode.OK, json)
private fun MockRequestHandleScope.status(code: Int, body: String) = respond(body, HttpStatusCode.fromValue(code), json)

private fun HttpRequestData.bodyText(): String = (body as? OutgoingContent.ByteArrayContent)?.bytes()?.decodeToString().orEmpty()

private class Harness(
    val store: InMemorySecureStore = InMemorySecureStore(),
    handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
) {
    val requests = mutableListOf<HttpRequestData>()
    val session = SessionRepository(store, "http://api.test/api/v1") { tokens ->
        createHttpClient("http://api.test/api/v1", tokens, MockEngine { request -> requests += request; handler(request) })
    }
}

class SessionRepositoryTest {

    @Test
    fun loginGuardaTokensYEmpresaYDejaLaSesionAbierta() = runTest {
        val h = Harness { request ->
            when (request.url.encodedPath) {
                "/api/v1/auth/login" -> ok("""{"token":"A1","refreshToken":"R1","user":{}}""")
                "/api/v1/auth/me" -> ok(ME_STAFF)
                else -> status(404, "{}")
            }
        }
        h.session.login(" Altamira ", "karla.nunez", "clave-de-prueba")

        val state = h.session.state.value
        assertIs<SessionState.SignedIn>(state)
        assertEquals("Karla", state.me.firstName)
        assertEquals(PermissionScope.OWN, state.me.scope("attendance.view"))
        assertEquals(listOf("WEB", "APP"), state.me.tenant?.punchChannels)
        assertEquals("A1", h.store.get(SessionRepository.KEY_ACCESS))
        assertEquals("R1", h.store.get(SessionRepository.KEY_REFRESH))
        assertEquals("altamira", h.session.lastTenant)
        assertTrue(h.requests.first().bodyText().contains("\"tenant\":\"altamira\""))
        assertEquals("Bearer A1", h.requests.last().headers[HttpHeaders.Authorization])
        assertEquals(Destination.Home, destinationFor(state))
    }

    @Test
    fun credencialesInvalidasDevuelvenElMensajeDelApiSinGuardarNada() = runTest {
        val h = Harness {
            status(401, """{"error":"HttpError","code":"INVALID_CREDENTIALS","message":"Credenciales inválidas"}""")
        }
        val error = assertFailsWith<ApiException> { h.session.login("altamira", "karla.nunez", "mala") }

        assertEquals("INVALID_CREDENTIALS", error.code)
        assertEquals("Credenciales inválidas", error.message)
        assertNull(h.store.get(SessionRepository.KEY_ACCESS))
        assertNull(h.requests.single().headers[HttpHeaders.Authorization])
    }

    @Test
    fun laSesionPersisteYSeRestauraConUnRepositorioNuevo() = runTest {
        val store = InMemorySecureStore()
        val first = Harness(store) { request ->
            if (request.url.encodedPath.endsWith("/auth/login")) ok("""{"token":"A1","refreshToken":"R1"}""") else ok(ME_STAFF)
        }
        first.session.login("altamira", "karla.nunez", "clave-de-prueba")

        val second = Harness(store) { ok(ME_STAFF) }
        assertIs<SessionState.Restoring>(second.session.state.value)
        second.session.restore()

        assertIs<SessionState.SignedIn>(second.session.state.value)
        assertEquals("Bearer A1", second.requests.single().headers[HttpHeaders.Authorization])
    }

    @Test
    fun sinRedRestauraConLaSesionGuardada() = runTest {
        val store = InMemorySecureStore()
        Harness(store) { request ->
            if (request.url.encodedPath.endsWith("/auth/login")) ok("""{"token":"A1","refreshToken":"R1"}""") else ok(ME_STAFF)
        }.session.login("altamira", "karla.nunez", "clave-de-prueba")

        val offline = Harness(store) { throw IllegalStateException("sin red") }
        offline.session.restore()

        val state = offline.session.state.value
        assertIs<SessionState.SignedIn>(state)
        assertEquals("karla.nunez", state.me.username)
    }

    @Test
    fun un401RefrescaElTokenYReintentaLaPeticion() = runTest {
        val store = InMemorySecureStore().apply {
            put(SessionRepository.KEY_ACCESS, "VIEJO")
            put(SessionRepository.KEY_REFRESH, "R1")
        }
        val h = Harness(store) { request ->
            when {
                request.url.encodedPath.endsWith("/auth/refresh") -> ok("""{"token":"NUEVO","refreshToken":"R2"}""")
                request.headers[HttpHeaders.Authorization] == "Bearer NUEVO" -> ok(ME_STAFF)
                else -> status(401, """{"code":"INVALID_TOKEN","message":"Token inválido o expirado"}""")
            }
        }
        h.session.restore()

        assertIs<SessionState.SignedIn>(h.session.state.value)
        assertEquals("NUEVO", store.get(SessionRepository.KEY_ACCESS))
        assertEquals("R2", store.get(SessionRepository.KEY_REFRESH))
        assertTrue(h.requests.any { it.url.encodedPath.endsWith("/auth/refresh") && it.bodyText().contains("R1") })
    }

    @Test
    fun siElRefreshFallaSeCierraLaSesionYSeBorranLosTokens() = runTest {
        val store = InMemorySecureStore().apply {
            put(SessionRepository.KEY_ACCESS, "VIEJO")
            put(SessionRepository.KEY_REFRESH, "R1")
        }
        val h = Harness(store) { status(401, """{"code":"INVALID_TOKEN","message":"Token inválido o expirado"}""") }
        h.session.restore()

        val state = h.session.state.value
        assertIs<SessionState.SignedOut>(state)
        assertEquals(SessionRepository.EXPIRED, state.notice)
        assertNull(store.get(SessionRepository.KEY_ACCESS))
        assertNull(store.get(SessionRepository.KEY_REFRESH))
    }

    @Test
    fun cerrarSesionBorraTokensPeroRecuerdaLaEmpresa() = runTest {
        val h = Harness { request ->
            if (request.url.encodedPath.endsWith("/auth/login")) ok("""{"token":"A1","refreshToken":"R1"}""") else ok(ME_STAFF)
        }
        h.session.login("altamira", "karla.nunez", "clave-de-prueba")
        h.session.signOut()

        assertIs<SessionState.SignedOut>(h.session.state.value)
        assertNull(h.store.get(SessionRepository.KEY_ACCESS))
        assertNull(h.store.get(SessionRepository.KEY_ME))
        assertEquals("altamira", h.session.lastTenant)
    }

    @Test
    fun unaCuentaDePlataformaNoEntraALaApp() = runTest {
        val h = Harness { request ->
            if (request.url.encodedPath.endsWith("/auth/login")) ok("""{"token":"A1","refreshToken":"R1"}""") else ok(ME_PLATFORM)
        }
        val error = assertFailsWith<ApiException> { h.session.login("altamira", "demo.admin", "x") }

        assertEquals("PLATFORM_USES_WEB", error.code)
        val state = h.session.state.value
        assertIs<SessionState.SignedOut>(state)
        assertEquals(SessionRepository.PLATFORM_ONLY_WEB, state.notice)
        assertNull(h.store.get(SessionRepository.KEY_ACCESS))
    }

    @Test
    fun sinCodigoDeEmpresaNoIntentaLaRed() = runTest {
        val h = Harness { error("no debería llamar") }
        assertEquals("TENANT_REQUIRED", assertFailsWith<ApiException> { h.session.login("  ", "a", "b") }.code)
    }

    @Test
    fun sinServidorConfiguradoNoIntentaLaRed() = runTest {
        val store = InMemorySecureStore()
        val session = SessionRepository(store, "") { tokens ->
            createHttpClient("http://nunca", tokens, MockEngine { error("no debería llamar") })
        }
        val error = assertFailsWith<ApiException> { session.login("altamira", "a", "b") }
        assertEquals(ApiException.NO_SERVER, error.code)
    }
}

class DestinationTest {
    private fun me(raw: String) = com.axzydev.checklab.core.network.ApiJson.decodeFromString<Me>(raw)

    @Test
    fun cadaEstadoLlevaASuPantallaRaiz() {
        assertEquals(Destination.Splash, destinationFor(SessionState.Restoring))
        assertEquals(Destination.Login, destinationFor(SessionState.SignedOut()))
        assertEquals(Destination.Home, destinationFor(SessionState.SignedIn(me(ME_STAFF))))
        assertEquals(Destination.ChangePassword, destinationFor(SessionState.SignedIn(me(ME_PROVISIONAL))))
    }

    @Test
    fun losPermisosSalenDelMapaDelApi() {
        val staff = me(ME_STAFF)
        assertTrue(staff.can("attendance.view"))
        assertTrue(!staff.can("hr.records"))
        assertEquals(PermissionScope.NONE, staff.scope("payroll.view"))
    }

    @Test
    fun laNuevaContrasenaSeValidaComoEnElApi() {
        assertEquals("Escribe tu contraseña actual.", validateNewPassword("", "abcdef", "abcdef"))
        assertEquals("La nueva contraseña debe tener al menos 6 caracteres.", validateNewPassword("x", "abc", "abc"))
        assertEquals("La nueva contraseña debe ser distinta de la actual.", validateNewPassword("abcdef", "abcdef", "abcdef"))
        assertEquals("Las contraseñas no coinciden.", validateNewPassword("x", "abcdef", "abcdeg"))
        assertNull(validateNewPassword("x", "abcdef", "abcdef"))
    }
}
