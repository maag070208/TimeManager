package com.axzydev.checklab.clocks

import com.axzydev.checklab.testing.CLOCK_ROSTER
import com.axzydev.checklab.testing.CLOCK_SUMMARY
import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.WEEKLY_ATTENDANCE
import com.axzydev.checklab.testing.bodyJson
import com.axzydev.checklab.testing.fail
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import com.axzydev.checklab.core.network.ApiException
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals

class ClocksApiTest {
    private val api = MockApi { request ->
        when (request.route) {
            "time-clock/summary" -> ok(CLOCK_SUMMARY)
            "time-clock/roster" -> ok(CLOCK_ROSTER)
            "time-clock/sync" -> fail(409, "SYNC_IN_PROGRESS", "Todos los relojes ya se están sincronizando")
            else -> ok("{}")
        }
    }
    private val clocks = ClocksApi(api.client)

    @Test
    fun elResumenDelRelojSeLeeIgnorandoLoQueLaAppNoUsa() = runTest {
        val s = clocks.summary()
        val c = s.clocks.single()
        assertEquals("Andén 3 · Entrada de personal", c.name)
        assertEquals(ClockLink.Down, clockLink(c.connection))
        assertEquals(false, c.lastSyncOk)
        assertEquals(8, s.roster.unlinked)
        assertEquals(listOf("UNLINKED" to 8), s.alerts.map { it.code to it.count })
        assertEquals("Bearer TOKEN", api.last.headers[HttpHeaders.Authorization])
    }

    @Test
    fun elPadronTraeLasPersonasSinVincularConSusRelojes() = runTest {
        val r = clocks.roster()
        assertEquals(listOf("1000", "1001"), r.unlinked.map { it.employeeNumber })
        assertEquals(listOf("Andén 3 · Entrada de personal"), r.unlinked.first().clocks)
    }

    @Test
    fun sincronizarEsUnPostYSuErrorLlegaConElMensajeDelApi() = runTest {
        val e = assertFailsWith<ApiException> { clocks.sync() }
        assertEquals(HttpMethod.Post, api.last.method)
        assertEquals("SYNC_IN_PROGRESS", e.code)
        assertEquals("Todos los relojes ya se están sincronizando", e.message)
    }
}

class ClockLabelsTest {
    @Test
    fun cadaEstadoDeConexionDelApiTieneSuEtiqueta() {
        assertEquals(ClockLink.Online, clockLink("ONLINE"))
        assertEquals(ClockLink.Down, clockLink("NO_RESPONSE"))
        assertEquals(ClockLink.Credentials, clockLink("PAUSED_CREDENTIALS"))
        assertEquals(ClockLink.Unknown, clockLink("NOT_READ"))
        assertEquals(ClockLink.Unknown, clockLink("ALGO_NUEVO"))
    }

    @Test
    fun todasLasAlertasDelResumenSeMuestranEnEspanol() {
        val codes = listOf("UNLINKED", "NO_RESPONSE", "CREDENTIALS", "SYNC_ERROR", "PENDING_REMOVALS", "REAPPEARED", "SUSPICIOUS_ROSTER")
        codes.forEach { assertNotEquals(it, alertText(it), "falta texto para $it") }
        assertEquals("ALGO_NUEVO", alertText("ALGO_NUEVO"))
    }
}

class AttendanceTest {
    private val api = MockApi { ok(WEEKLY_ATTENDANCE) }

    @Test
    fun laSemanaSePideConLaFechaYTraeLosSieteDias() = runTest {
        val week = AttendanceApi(api.client).week("2026-11-05")
        assertEquals("schedules/weekly-attendance", api.last.route)
        assertEquals(HttpMethod.Post, api.last.method)
        assertEquals(JsonPrimitive("2026-11-05"), api.last.bodyJson()["date"])
        assertEquals(7, week.range.days.size)
        val row = week.rows.single()
        assertEquals("Almacén", row.departmentName)
        assertEquals(listOf("WORKED", "OVERTIME", "ABSENCE", "INCOMPLETE"), row.days.map { it.status })
        assertEquals(12, row.days.last().lateMin)
    }

    @Test
    fun cadaEstadoDelDiaTieneSuSimboloEnLaRejilla() {
        val symbols = listOf("WORKED", "OVERTIME", "ABSENCE", "INCOMPLETE", "REST", "REST_WORKED", "FUTURE", "NO_INFO")
            .map { dayCell(it).first }
        assertEquals(listOf("✓", "+", "F", "½", "D", "D+", "·", "?"), symbols)
    }
}

class AttendanceWeekNavigationTest {
    @Test
    fun laSemanaArrancaEnElHoyDeLaEmpresaYAvanzaDeSieteEnSiete() {
        val api = MockApi { ok(WEEKLY_ATTENDANCE) }
        val vm = AttendanceViewModel(AttendanceApi(api.client)) { kotlinx.datetime.LocalDate(2026, 11, 7) }
        assertEquals("2026-11-07", vm.date)
        vm.shift(1)
        assertEquals("2026-11-14", vm.date)
        vm.shift(-1)
        vm.shift(-1)
        assertEquals("2026-10-31", vm.date)
    }
}
