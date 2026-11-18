package com.axzydev.checklab.core.network

import com.axzydev.checklab.nom.WorkerApi
import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.fail
import com.axzydev.checklab.testing.ok
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlinx.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SupportCodeTest {
    private suspend fun failureOf(api: MockApi): ApiException = assertFailsWith<ApiException> { WorkerApi(api.client).myPrivacy() }

    @Test
    fun elMensajeDelApiSeMuestraTalCualConSuCodigo() = runTest {
        val error = failureOf(
            MockApi { respond("""{"code":"DATABASE_UNAVAILABLE","supportCode":"AX-01","message":"[AX-01] Algo salió mal de nuestro lado."}""", HttpStatusCode.ServiceUnavailable, io.ktor.http.headersOf(io.ktor.http.HttpHeaders.ContentType, "application/json")) },
        )
        assertEquals("AX-01", error.supportCode)
        assertEquals("[AX-01] Algo salió mal de nuestro lado.", error.message)
    }

    @Test
    fun unErrorDeNegocioNoLlevaCodigo() = runTest {
        val error = failureOf(MockApi { fail(409, "PRIVACY_NOTICE_NOT_SET", "Tu empresa aún no publica su aviso.") })
        assertNull(error.supportCode)
        assertEquals("Tu empresa aún no publica su aviso.", error.message)
    }

    @Test
    fun unBadGatewaySinCuerpoDelApiEsAX12() = runTest {
        val error = failureOf(MockApi { respond("<html>Bad Gateway</html>", HttpStatusCode.BadGateway) })
        assertEquals(SupportCode.UNAVAILABLE, error.supportCode)
        assertFalse("502" in error.message)
        assertTrue(error.message.startsWith("[AX-12] "))
    }

    @Test
    fun sinConexionEsAX10() = runTest {
        val error = failureOf(MockApi { throw IOException("Unable to resolve host api.test") })
        assertTrue(error.isNetwork)
        assertEquals(SupportCode.NO_CONNECTION, error.supportCode)
        assertFalse("resolve" in error.message)
    }

    @Test
    fun unaRespuestaIlegibleEsAX13YNoTruenaLaPantalla() = runTest {
        val error = failureOf(MockApi { ok("""{"notice": 42, "version": "no"}""") })
        assertEquals(SupportCode.UNEXPECTED, error.supportCode)
    }
}
