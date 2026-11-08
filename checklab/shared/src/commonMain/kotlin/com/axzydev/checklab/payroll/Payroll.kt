package com.axzydev.checklab.payroll

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.approvals.ListFrame
import com.axzydev.checklab.approvals.ListViewModel
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.network.apiCall
import com.axzydev.checklab.core.time.formatMinutes
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.navigation.Avatar
import com.axzydev.checklab.people.Named
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.todayIn
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.roundToLong
import kotlin.time.Clock
import org.koin.compose.viewmodel.koinViewModel

@Serializable
data class Totals(
    val workedMin: Int = 0,
    val scheduledMin: Int = 0,
    val extraMin: Int = 0,
    val approvedExtraMin: Int = 0,
    val pendingExtraMin: Int = 0,
    val missingMin: Int = 0,
    val absences: Int = 0,
)

@Serializable
data class Position(val name: String, val dailySalary: Double = 0.0, val sbcDaily: Double? = null)

@Serializable
data class WeekRow(
    val userId: String,
    val name: String,
    val employeeNumber: String? = null,
    val clockNumbers: List<String> = emptyList(),
    val departmentId: String? = null,
    val departmentName: String? = null,
    val payrollPosition: Position? = null,
    val totals: Totals = Totals(),
)

@Serializable
data class WeekRange(val days: List<String> = emptyList())

@Serializable
data class WeekSummary(
    val workedMin: Int = 0,
    val extraMin: Int = 0,
    val approvedExtraMin: Int = 0,
    val pendingExtraMin: Int = 0,
    val absences: Int = 0,
    val people: Int = 0,
    val weeklySalaryCost: Double = 0.0,
    val dailySalaryTotal: Double = 0.0,
)

@Serializable
data class WeekReport(val range: WeekRange = WeekRange(), val rows: List<WeekRow> = emptyList(), val summary: WeekSummary = WeekSummary())

@Serializable
data class ReviewEntry(val departmentId: String? = null, val departmentName: String? = null, val reviewedBy: Named? = null)

@Serializable
data class Closure(
    val weekStart: String,
    val closed: Boolean = false,
    val closedAt: String? = null,
    val closedBy: Named? = null,
    val reopenedAt: String? = null,
    val reopenedBy: Named? = null,
)

@Serializable
data class ReviewState(val weekStart: String, val closed: Boolean = false, val closure: Closure? = null, val reviews: List<ReviewEntry> = emptyList())

@Serializable
data class WeekQuery(val date: String)

@Serializable
data class SetReview(val weekStart: String, val departmentId: String?, val reviewed: Boolean)

@Serializable
data class CloseWeek(val weekStart: String, val departmentIds: List<String?>, val snapshot: JsonObject)

@Serializable
data class Reopen(val weekStart: String)

@Serializable
data class PayrollPosition(
    val id: String,
    val name: String,
    val jobTitle: String? = null,
    val dailySalary: Double = 0.0,
    val sbcDaily: Double? = null,
    val active: Boolean = true,
    val employees: List<Named> = emptyList(),
)

@Serializable
data class PositionInput(val name: String, val jobTitle: String? = null, val dailySalary: Double)

@Serializable
data class PositionActive(val active: Boolean)

class PayrollApi(private val client: HttpClient) {
    suspend fun week(date: String): WeekReport = apiCall { client.post("schedules/weekly-attendance") { setBody(WeekQuery(date)) } }
    suspend fun reviewState(weekStart: String): ReviewState = apiCall { client.get("schedules/payroll/review-state") { parameter("weekStart", weekStart) } }
    suspend fun setReview(r: SetReview): ReviewState = apiCall { client.put("schedules/payroll/reviews") { setBody(r) } }
    suspend fun close(c: CloseWeek): ReviewState = apiCall { client.post("schedules/payroll/close") { setBody(c) } }
    suspend fun reopen(weekStart: String): ReviewState = apiCall { client.post("schedules/payroll/reopen") { setBody(Reopen(weekStart)) } }
    suspend fun closures(): List<Closure> = apiCall { client.get("schedules/payroll/closures") }
    suspend fun positions(): List<PayrollPosition> = apiCall { client.get("payroll/positions") }
    suspend fun createPosition(p: PositionInput): JsonObject = apiCall { client.post("payroll/positions") { setBody(p) } }
    suspend fun setPositionActive(id: String, active: Boolean): JsonObject = apiCall { client.patch("payroll/positions/$id") { setBody(PositionActive(active)) } }
}

fun money(v: Double): String {
    val cents = (v * 100).roundToLong()
    val whole = (cents / 100).toString().reversed().chunked(3).joinToString(",").reversed()
    return "$$whole.${(cents % 100).toString().padStart(2, '0')}"
}

data class PayrollWeek(val report: WeekReport, val review: ReviewState)

/** Departamento de la pre-nómina: sus personas y si ya se revisó. */
data class DeptGroup(val id: String?, val name: String, val rows: List<WeekRow>, val reviewed: Boolean)

fun PayrollWeek.groups(): List<DeptGroup> = report.rows.groupBy { it.departmentId }.map { (id, rows) ->
    DeptGroup(id, rows.first().departmentName ?: "Sin departamento", rows.sortedBy { it.name }, review.reviews.any { it.departmentId == id })
}.sortedBy { it.name }

/** Snapshot del cierre con la misma forma que guarda la web (`people[]`). */
fun PayrollWeek.snapshot(): JsonObject = JsonObject(
    mapOf(
        "people" to JsonArray(
            report.rows.map { r ->
                JsonObject(
                    mapOf(
                        "name" to JsonPrimitive(r.name),
                        "clock" to JsonPrimitive(r.clockNumbers.firstOrNull() ?: r.employeeNumber.orEmpty()),
                        "departmentId" to JsonPrimitive(r.departmentId),
                        "workedMin" to JsonPrimitive(r.totals.workedMin),
                        "extraMin" to JsonPrimitive(r.totals.extraMin),
                        "approvedExtraMin" to JsonPrimitive(r.totals.approvedExtraMin),
                        "absences" to JsonPrimitive(r.totals.absences),
                    ),
                )
            },
        ),
    ),
)

class PayrollViewModel(private val api: PayrollApi) : ListViewModel<PayrollWeek>() {
    var date: String = Clock.System.todayIn(TimeZone.currentSystemDefault()).toString()
        private set

    override suspend fun fetch(): PayrollWeek {
        val report = api.week(date)
        val weekStart = report.range.days.firstOrNull() ?: date
        return PayrollWeek(report, api.reviewState(weekStart))
    }

    fun shift(weeks: Int) {
        date = LocalDate.parse(date).let { if (weeks > 0) it.plus(DatePeriod(days = 7)) else it.minus(DatePeriod(days = 7)) }.toString()
        load()
    }

    fun review(week: PayrollWeek, g: DeptGroup, reviewed: Boolean) =
        act(if (reviewed) "${g.name}: revisado." else "${g.name}: revisión quitada.") { api.setReview(SetReview(week.review.weekStart, g.id, reviewed)) }

    fun close(week: PayrollWeek) = act("Semana cerrada; se guardó la fotografía de las cifras.") {
        api.close(CloseWeek(week.review.weekStart, week.groups().map { it.id }, week.snapshot()))
    }

    fun reopen(week: PayrollWeek) = act("Semana reabierta.") { api.reopen(week.review.weekStart) }
}

@Composable
fun ColumnScope.PayrollContent(me: Me, vm: PayrollViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    PillTabs(listOf("Semana", "Historial de cierres"), tab, { tab = it })
    if (tab == 1) {
        ClosuresList()
        return
    }
    val canClose = me.can("payroll.close")
    Row(verticalAlignment = Alignment.CenterVertically) {
        LinkButton("‹ Anterior", { vm.shift(-1) })
        Text("Semana del ${vm.date}", Modifier.weight(1f), color = Brand.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
        LinkButton("Siguiente ›", { vm.shift(1) })
    }
    ListFrame(state) { week ->
        val s = week.report.summary
        val days = week.report.range.days
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Pre-nómina · ${days.firstOrNull().orEmpty()} al ${days.lastOrNull().orEmpty()}")
            if (week.review.closed) Notice("Semana cerrada el ${week.review.closure?.closedAt?.take(10)} por ${week.review.closure?.closedBy?.name ?: "—"}.", error = false)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Personas", "${s.people}", Modifier.weight(1f))
                Kpi("Trabajado", formatMinutes(s.workedMin), Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Extra aprobado", formatMinutes(s.approvedExtraMin), Modifier.weight(1f), accent = Brand.MintInk, tint = Brand.MintSoft)
                Kpi("Extra pendiente", formatMinutes(s.pendingExtraMin), Modifier.weight(1f), accent = Brand.AmberInk, tint = Brand.AmberSoft)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Faltas", "${s.absences}", Modifier.weight(1f), accent = Brand.Rose)
                Kpi("Costo semanal", money(s.weeklySalaryCost), Modifier.weight(1.4f))
            }
        }
        val groups = week.groups()
        groups.forEach { g ->
            BentoCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(g.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    if (canClose && !week.review.closed) {
                        Text(if (g.reviewed) "Revisado" else "Revisar", color = if (g.reviewed) Brand.MintInk else Brand.Muted, fontSize = 13.sp)
                        Switch(g.reviewed, { vm.review(week, g, it) }, colors = SwitchDefaults.colors(checkedTrackColor = Brand.MintInk))
                    } else if (g.reviewed) {
                        Text("Revisado", color = Brand.MintInk, fontSize = 13.sp)
                    }
                }
                val cost = g.rows.sumOf { (it.payrollPosition?.dailySalary ?: 0.0) * 7 }
                InfoRow("Costo de la plantilla (7 días)", money(cost))
                g.rows.forEach { r ->
                    val t = r.totals
                    ListRow(
                        title = r.name,
                        detail = "Trabajó ${formatMinutes(t.workedMin)} de ${formatMinutes(t.scheduledMin)} · extra ${formatMinutes(t.approvedExtraMin)} aprobado${if (t.pendingExtraMin > 0) " + ${formatMinutes(t.pendingExtraMin)} por aprobar" else ""}${if (t.absences > 0) " · ${t.absences} falta${if (t.absences > 1) "s" else ""}" else ""}${r.payrollPosition?.let { "\n${it.name} · ${money(it.dailySalary)}/día" } ?: "\nSin puesto de nómina"}",
                        status = if (t.absences > 0) "Faltas" else null,
                        statusColor = Brand.Rose,
                        statusTint = Brand.RoseSoft,
                        leading = { Avatar(r.name, 28) },
                    )
                }
            }
        }
        if (canClose) {
            BentoCard(Modifier.fillMaxWidth()) {
                if (week.review.closed) {
                    Eyebrow("Reabrir")
                    Text("Reabrir deja registro y permite corregir; el cierre anterior queda en el historial.", color = Brand.Muted, fontSize = 13.sp)
                    PrimaryButton("Reabrir la semana", { vm.reopen(week) }, busy = state.busy)
                } else {
                    val pending = groups.count { !it.reviewed }
                    Eyebrow("Cerrar la semana")
                    Text(
                        if (pending == 0) "Todos los departamentos están revisados. Al cerrar se guarda la fotografía de las cifras."
                        else "Faltan $pending departamento${if (pending == 1) "" else "s"} por revisar.",
                        color = Brand.Muted,
                        fontSize = 13.sp,
                    )
                    PrimaryButton("Cerrar semana", { vm.close(week) }, enabled = pending == 0, busy = state.busy)
                }
            }
        }
    }
}

class ClosuresViewModel(private val api: PayrollApi) : ListViewModel<List<Closure>>() {
    override suspend fun fetch() = api.closures()
}

@Composable
private fun ColumnScope.ClosuresList(vm: ClosuresViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    ListFrame(state) { list ->
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Cierres")
            if (list.isEmpty()) Text("Aún no hay semanas cerradas.", color = Brand.Muted)
            list.forEach { c ->
                ListRow(
                    title = "Semana del ${c.weekStart}",
                    detail = buildString {
                        append("Cerrada ${c.closedAt?.take(10).orEmpty()} por ${c.closedBy?.name ?: "—"}")
                        if (c.reopenedAt != null) append("\nReabierta ${c.reopenedAt.take(10)} por ${c.reopenedBy?.name ?: "—"}")
                    },
                    status = if (c.closed) "Cerrada" else "Reabierta",
                    statusColor = if (c.closed) Brand.MintInk else Brand.AmberInk,
                    statusTint = if (c.closed) Brand.MintSoft else Brand.AmberSoft,
                )
            }
        }
    }
}

// ── Puestos de nómina ─────────────────────────────────────────────────────

class PositionsViewModel(private val api: PayrollApi) : ListViewModel<List<PayrollPosition>>() {
    override suspend fun fetch() = api.positions()
    fun create(name: String, job: String, salary: Double) = act("Puesto creado.") { api.createPosition(PositionInput(name.trim(), job.ifBlank { null }, salary)) }
    fun toggle(p: PayrollPosition) = act(if (p.active) "Puesto desactivado; su personal quedó sin puesto." else "Puesto activado.") { api.setPositionActive(p.id, !p.active) }
}

@Composable
fun ColumnScope.PositionsContent(me: Me, vm: PositionsViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var name by rememberSaveable { mutableStateOf("") }
    var job by rememberSaveable { mutableStateOf("") }
    var salary by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(Unit) { vm.load() }
    val canManage = me.can("payroll.close")
    ListFrame(state) { list ->
        list.sortedByDescending { it.active }.forEach { p ->
            BentoCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        Text(p.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = if (p.active) Brand.Ink else Brand.Muted)
                    }
                    Text(money(p.dailySalary) + "/día", fontWeight = FontWeight.Bold)
                }
                InfoRow("Puesto", p.jobTitle ?: "—")
                p.sbcDaily?.let { InfoRow("SBC diario", money(it)) }
                InfoRow("Personas", "${p.employees.size}")
                if (canManage) LinkButton(if (p.active) "Desactivar" else "Activar", { vm.toggle(p) })
            }
        }
        if (canManage) {
            BentoCard(Modifier.fillMaxWidth()) {
                Eyebrow("Nuevo puesto")
                Field(name, { name = it }, "Nombre del puesto")
                Field(job, { job = it }, "Puesto (opcional)")
                Field(salary, { salary = it.filter { c -> c.isDigit() || c == '.' } }, "Salario diario")
                PrimaryButton(
                    "Crear puesto",
                    { salary.toDoubleOrNull()?.let { vm.create(name, job, it); name = ""; job = ""; salary = "" } },
                    enabled = name.trim().length >= 2 && (salary.toDoubleOrNull() ?: 0.0) > 0,
                    busy = state.busy,
                )
            }
        }
    }
}
