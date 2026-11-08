package com.axzydev.checklab.contract

import com.axzydev.checklab.approvals.ApprovalsApi
import com.axzydev.checklab.approvals.OvertimeItem
import com.axzydev.checklab.nom.AcknowledgeRequest
import com.axzydev.checklab.nom.CreateLeave
import com.axzydev.checklab.nom.WorkerApi
import com.axzydev.checklab.payroll.CloseWeek
import com.axzydev.checklab.payroll.PayrollApi
import com.axzydev.checklab.payroll.PositionInput
import com.axzydev.checklab.payroll.SetReview
import com.axzydev.checklab.people.CreatePerson
import com.axzydev.checklab.people.PeopleApi
import com.axzydev.checklab.schedules.AssignInput
import com.axzydev.checklab.schedules.ScheduleDay
import com.axzydev.checklab.schedules.ScheduleInput
import com.axzydev.checklab.schedules.SchedulesApi
import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.bodyJson
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import io.ktor.http.HttpMethod
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Cuerpos de escritura contra los DTO del API (zod en `api/src/modules/<modulo>/models/dto`,
 * o la lectura de `req.body` en el controlador cuando no hay DTO). La app serializa con
 * `explicitNulls = false` y sin valores por defecto: un campo nulo u omitido puede cambiar
 * el significado o hacer que el API rechace la petición entera.
 */
class WriteBodiesTest {
    private val api = MockApi { request ->
        when (request.route) {
            "schedules/payroll/reviews", "schedules/payroll/close" -> ok("""{"weekStart":"2026-10-28","reviews":[],"closure":null}""")
            "nom/me/record-acknowledgments" -> ok("{}")
            "nom/me/leave/requests" -> ok("""{"id":"l1","status":"PENDING","startDate":"2026-11-20","endDate":"2026-11-21","days":2}""")
            "overtime/approvals" -> ok("""{"updated":1,"skipped":0}""")
            else -> ok("{}")
        }
    }

    private fun keysOfLast() = api.last.bodyJson().keys

    // PayrollReviewUpsertDto: { weekStart, departmentId: string | null (OBLIGATORIO), reviewed }
    @Test
    fun revisarElGrupoSinDepartamentoMandaDepartmentIdNull() = runTest {
        runCatching { PayrollApi(api.client).setReview(SetReview("2026-10-28", null, true)) }
        val body = api.last.bodyJson()
        assertEquals(HttpMethod.Put, api.last.method)
        assertEquals(setOf("weekStart", "departmentId", "reviewed"), body.keys)
        assertEquals(JsonNull, body["departmentId"])
    }

    @Test
    fun revisarUnDepartamentoMandaSuId() = runTest {
        runCatching { PayrollApi(api.client).setReview(SetReview("2026-10-28", "d1", false)) }
        val body = api.last.bodyJson()
        assertEquals(JsonPrimitive("d1"), body["departmentId"])
        assertEquals(JsonPrimitive(false), body["reviewed"])
    }

    // PayrollCloseDto: { weekStart, departmentIds: (string | null)[], snapshot? }
    @Test
    fun cerrarLaSemanaConservaElNullDeSinDepartamento() = runTest {
        runCatching { PayrollApi(api.client).close(CloseWeek("2026-10-28", listOf("d1", null), JsonObject(emptyMap()))) }
        val ids = api.last.bodyJson()["departmentIds"]!!.jsonArray
        assertEquals(JsonArray(listOf(JsonPrimitive("d1"), JsonNull)), ids)
    }

    // PayrollPositionCreateDto (strict): { name, jobTitle?, dailySalary, sbcDaily? }
    @Test
    fun unPuestoSoloMandaClavesDelDtoEstricto() = runTest {
        PayrollApi(api.client).createPosition(PositionInput("Surtidor", null, 315.04))
        assertTrue(setOf("name", "jobTitle", "dailySalary", "sbcDaily").containsAll(keysOfLast()))
        assertEquals(setOf("name", "dailySalary"), keysOfLast())
    }

    // ScheduleCreateDto: días con weekday 1..7 y horas HH:mm opcionales.
    @Test
    fun unHorarioMandaSieteDiasDeUnoASiete() = runTest {
        val days = (1..7).map { ScheduleDay(it, "09:00", "18:00", restDay = it == 7) }
        SchedulesApi(api.client).create(ScheduleInput("Matutino", 10, 10, 30, 30, false, days))
        val sent = api.last.bodyJson()["days"]!!.jsonArray.map { it.jsonObject }
        assertEquals((1..7).map { JsonPrimitive(it) }, sent.map { it["weekday"] })
        assertEquals(JsonPrimitive(true), sent.last()["restDay"])
        assertTrue(sent.all { setOf("weekday", "startTime", "endTime", "splitStartTime", "splitEndTime", "restDay").containsAll(it.keys) })
    }

    // AssignmentCreateDto: { scheduleId, userIds, from }
    @Test
    fun asignarHorarioMandaPersonasYFecha() = runTest {
        SchedulesApi(api.client).assign(AssignInput("s1", listOf("u1", "u2"), "2026-11-09"))
        assertEquals("schedules/assignments", api.last.route)
        assertEquals(setOf("scheduleId", "userIds", "from"), keysOfLast())
    }

    // UserCreateDto: email opcional; un correo vacío no debe mandarse como null.
    @Test
    fun altaDePersonaSinCorreoNoMandaNulos() = runTest {
        PeopleApi(api.client).create(CreatePerson(username = "nuevo", password = "Clave-1234", name = "Nuevo Ingreso"))
        val body = api.last.bodyJson()
        assertEquals(setOf("username", "password", "name"), body.keys)
    }

    // acknowledgeRecord lee `accept !== false`: si accept=false se omitiera, la objeción contaría como firma.
    @Test
    fun objetarLaConstanciaMandaAcceptFalseExplicito() = runTest {
        WorkerApi(api.client).acknowledge(AcknowledgeRequest("2026-10-28", "2026-11-03", accept = false, note = "Faltan horas del martes"))
        val body = api.last.bodyJson()
        assertEquals(JsonPrimitive(false), body["accept"])
        assertEquals(JsonPrimitive("Faltan horas del martes"), body["note"])
    }

    // decideOvertimeRequest lee `accept === true`: el rechazo debe llegar como false.
    @Test
    fun rechazarHorasExtraMandaAcceptFalse() = runTest {
        runCatching { WorkerApi(api.client).decideOvertime("o1", accept = false) }
        assertEquals("nom/me/overtime-requests/o1/decision", api.last.route)
        assertEquals(JsonPrimitive(false), api.last.bodyJson()["accept"])
    }

    // createMyLeaveRequest lee typeId, startDate, endDate y reason (string o null).
    @Test
    fun pedirVacacionesMandaTipoYFechas() = runTest {
        runCatching { WorkerApi(api.client).requestLeave(CreateLeave("t1", "2026-11-20", "2026-11-21")) }
        assertEquals(setOf("typeId", "startDate", "endDate"), keysOfLast())
    }

    // decideLeaveRequest lee `approve === true`.
    @Test
    fun rechazarUnPermisoMandaApproveFalse() = runTest {
        runCatching { ApprovalsApi(api.client).decideLeave("l1", approve = false, note = "  ") }
        val body = api.last.bodyJson()
        assertEquals(JsonPrimitive(false), body["approve"])
        assertEquals(null, body["note"], "una nota en blanco no se manda")
    }

    // OvertimeApprovalSchema: { filters, items: {userId,date}[], status: APPROVED|REJECTED|PENDING, note? }
    @Test
    fun aprobarTiempoExtraMandaLosDiasElegidos() = runTest {
        ApprovalsApi(api.client).decideOvertime("2026-11-05", listOf(OvertimeItem("u1", "2026-11-05")), approve = true, note = null)
        val body = api.last.bodyJson()
        assertEquals("overtime/approvals", api.last.route)
        assertEquals(JsonPrimitive("APPROVED"), body["status"])
        assertEquals(JsonPrimitive("WEEK"), body["filters"]!!.jsonObject["period"])
        assertEquals(1, body["items"]!!.jsonArray.size)
        assertTrue("status" !in body["filters"]!!.jsonObject, "el filtro de estado es solo de la consulta")
    }
}
