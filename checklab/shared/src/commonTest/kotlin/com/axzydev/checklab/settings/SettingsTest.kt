package com.axzydev.checklab.settings

import com.axzydev.checklab.home.Slot
import com.axzydev.checklab.testing.AUDIT_PAGE
import com.axzydev.checklab.testing.DISTRIBUTION_AGREEMENTS
import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.NOM_CONFIG
import com.axzydev.checklab.testing.ROLES
import com.axzydev.checklab.testing.TELEWORK_REGISTRATIONS
import com.axzydev.checklab.testing.bodyJson
import com.axzydev.checklab.testing.fail
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import io.ktor.http.HttpMethod
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Claves de `NomSettingsUpdateDto` (api/src/modules/nom/models/dto/nom.dto.ts, `.strict()`). */
private val NOM_SETTINGS_KEYS = setOf(
    "weekStartDay", "defaultEntryToleranceMin", "defaultExitToleranceMin", "defaultMealBreakMin", "defaultMinOvertimeMin",
    "workdayLimitMinutes", "weeklyLimitMinutes", "retentionMonths", "remotePunchEnabled", "remoteCountsForWorkday",
    "blockRemoteWithoutAgreement", "requireUnionForCollective", "remoteGeolocationEnabled", "lunchPunchEnabled",
)

class SettingsApiTest {
    private val api = MockApi { request ->
        when (request.route) {
            "nom/config" -> ok(NOM_CONFIG)
            "nom/distribution-agreements" -> if (request.method == HttpMethod.Post) ok("""{"id":"nuevo"}""") else ok(DISTRIBUTION_AGREEMENTS)
            "nom/telework/registrations" -> ok(TELEWORK_REGISTRATIONS)
            "permissions/roles" -> ok(ROLES)
            "audit" -> ok(AUDIT_PAGE)
            else -> ok("{}")
        }
    }
    private val settings = SettingsApi(api.client)

    @Test
    fun laConfiguracionSeLeeDeAttendanceDefaults() = runTest {
        val cfg = settings.config()
        assertEquals(3, cfg.weekStartDay)
        assertEquals(10, cfg.attendanceDefaults.entryToleranceMin)
        assertEquals(30, cfg.attendanceDefaults.minOvertimeMin)
        assertTrue(cfg.blockRemoteWithoutAgreement)
    }

    @Test
    fun guardarSoloMandaClavesQueAceptaElDtoEstricto() = runTest {
        settings.saveConfig(configUpdate("15", "", "45", "30", true, false, true, true, false, false))
        val body = api.last.bodyJson()
        assertEquals(HttpMethod.Put, api.last.method)
        assertTrue(NOM_SETTINGS_KEYS.containsAll(body.keys), "claves de más: ${body.keys - NOM_SETTINGS_KEYS}")
        assertEquals(JsonPrimitive(15), body["defaultEntryToleranceMin"])
        assertEquals(JsonPrimitive(0), body["defaultExitToleranceMin"])
        assertEquals(JsonPrimitive(false), body["remoteCountsForWorkday"])
        assertEquals(JsonPrimitive(false), body["remoteGeolocationEnabled"])
        assertEquals(JsonPrimitive(false), body["lunchPunchEnabled"])
    }

    @Test
    fun unConvenioIndividualNoMandaHorarioNulo() = runTest {
        settings.createAgreement(
            AgreementInput(userId = "u1", kind = "INDIVIDUAL", party = "WORKER", effectiveFrom = "2026-11-09", evidenceText = "Texto del convenio de jornada."),
        )
        val body = api.last.bodyJson()
        assertEquals(HttpMethod.Post, api.last.method)
        assertEquals(setOf("userId", "kind", "party", "effectiveFrom", "evidenceText"), body.keys)
    }

    @Test
    fun losConveniosTraenPersonaYFirma() = runTest {
        val a = settings.agreements().single()
        assertEquals("Guadalupe Isabel Ramírez Rodríguez", a.user?.name)
        assertEquals("2026-07-13T18:47:00.000Z", a.acceptedAt)
        assertNull(a.effectiveTo)
    }

    @Test
    fun teletrabajoYRolesSeLeen() = runTest {
        val r = settings.telework().single()
        assertEquals("REMOTO", r.mode)
        assertEquals("2027-11-04T16:00:00.000Z", r.nextPeriodicDueAt)
        assertEquals(listOf("ADMIN", "CLIENT_ADMIN"), settings.roles().map { it.key })
    }

    @Test
    fun laAuditoriaPidePaginaYLimite() = runTest {
        val page = settings.audit(3)
        assertEquals("3", api.last.url.parameters["page"])
        assertEquals("30", api.last.url.parameters["limit"])
        assertEquals(88, page.total)
        assertEquals(listOf("NOM_SETTINGS_UPDATED", "REMOTE_PUNCH_RECORDED"), page.data.map { it.action })
    }
}

class AuditLabelTest {
    @Test
    fun lasAccionesConocidasSeTraducenYLasDemasSeLeenComoTexto() {
        assertEquals("Configuración actualizada", auditLabel("NOM_SETTINGS_UPDATED"))
        assertEquals("Checada desde la app", auditLabel("REMOTE_PUNCH_RECORDED"))
        assertEquals("Holiday created", auditLabel("HOLIDAY_CREATED"))
    }
}

/** Espera a que el estado cumpla [done]; el MockEngine responde en otro hilo. */
private suspend fun <T> com.axzydev.checklab.approvals.ListViewModel<T>.awaitState(
    done: (com.axzydev.checklab.approvals.ListState<T>) -> Boolean,
): com.axzydev.checklab.approvals.ListState<T> =
    withContext(Dispatchers.Default) { withTimeout(5_000) { state.first(done) } }

private suspend fun awaitTrue(condition: () -> Boolean) =
    withContext(Dispatchers.Default) { withTimeout(5_000) { while (!condition()) kotlinx.coroutines.delay(10) } }

private fun <T> com.axzydev.checklab.approvals.ListState<T>.settled() = items !is Slot.Loading && !busy

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    @BeforeTest fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun guardarAvisaYRecargaLaConfiguracion() = runTest {
        val api = MockApi { ok(NOM_CONFIG) }
        val vm = ConfigViewModel(SettingsApi(api.client))
        vm.load()
        assertIs<Slot.Ready<NomConfig>>(vm.awaitState { it.settled() }.items)
        vm.save(configUpdate("10", "10", "30", "30", true, true, true, true, true, true))
        val saved = vm.awaitState { it.notice != null && it.settled() }
        awaitTrue { api.requests.size == 3 }
        assertEquals("Configuración guardada.", saved.notice)
        assertFalse(saved.busy)
        assertEquals(listOf(HttpMethod.Get, HttpMethod.Put, HttpMethod.Get), api.requests.map { it.method })
    }

    @Test
    fun unRechazoDelApiSeMuestraYNoSeMarcaComoGuardado() = runTest {
        val api = MockApi { request ->
            if (request.method == HttpMethod.Put) fail(403, "INSUFFICIENT_PERMISSIONS", "Permisos insuficientes") else ok(NOM_CONFIG)
        }
        val vm = ConfigViewModel(SettingsApi(api.client))
        vm.load()
        vm.awaitState { it.settled() }
        vm.save(configUpdate("10", "10", "30", "30", true, true, true, true, true, true))
        val after = vm.awaitState { it.error != null && !it.busy }
        assertEquals("Permisos insuficientes", after.error)
        assertNull(after.notice)
    }

    @Test
    fun siLaCargaFallaLaPantallaLoDice() = runTest {
        val vm = AuditViewModel(SettingsApi(MockApi { fail(500, "INTERNAL", "Algo salió mal") }.client))
        vm.load()
        assertEquals(Slot.Failed("Algo salió mal"), vm.awaitState { it.settled() }.items)
    }

    @Test
    fun laAuditoriaNoBajaDeLaPrimeraPagina() = runTest {
        val api = MockApi { ok(AUDIT_PAGE) }
        val vm = AuditViewModel(SettingsApi(api.client))
        vm.load()
        awaitTrue { api.requests.size == 1 }
        vm.go(-1)
        awaitTrue { api.requests.size == 2 }
        assertEquals(1, vm.page)
        vm.go(1)
        awaitTrue { api.requests.size == 3 }
        assertEquals(2, vm.page)
        assertEquals(listOf("1", "1", "2"), api.requests.map { it.url.parameters["page"] })
    }
}
