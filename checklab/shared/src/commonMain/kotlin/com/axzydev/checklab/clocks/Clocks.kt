package com.axzydev.checklab.clocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.approvals.ListFrame
import com.axzydev.checklab.approvals.ListViewModel
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.network.apiCall
import com.axzydev.checklab.core.time.timeInZone
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.navigation.Avatar
import com.axzydev.checklab.payroll.PayrollApi
import com.axzydev.checklab.payroll.WeekQuery
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.todayIn
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.time.Clock
import org.koin.compose.viewmodel.koinViewModel

@Serializable
data class ClockAlert(val code: String, val severity: String = "info", val count: Int = 0)

@Serializable
data class RosterCounts(val suspicious: Boolean = false, val pendingRemovals: Int = 0, val reappeared: Int = 0, val unlinked: Int = 0)

@Serializable
data class ClockCard(
    val serial: String,
    val name: String,
    val countsAttendance: Boolean = true,
    val connection: String = "UNKNOWN",
    val lastReadAt: String? = null,
    val lastSyncAt: String? = null,
    val lastSyncOk: Boolean? = null,
    val punchesToday: Int = 0,
)

@Serializable
data class ClockSummary(
    val timezone: String = "America/Mexico_City",
    val roster: RosterCounts = RosterCounts(),
    val alerts: List<ClockAlert> = emptyList(),
    val clocks: List<ClockCard> = emptyList(),
)

@Serializable
data class RosterPerson(val employeeNumber: String, val name: String, val clocks: List<String> = emptyList())

@Serializable
data class Roster(
    val unlinked: List<RosterPerson> = emptyList(),
    val pendingRemovals: List<JsonElement> = emptyList(),
    val reappeared: List<JsonElement> = emptyList(),
)

class ClocksApi(private val client: HttpClient) {
    suspend fun summary(): ClockSummary = apiCall { client.get("time-clock/summary") }
    suspend fun roster(): Roster = apiCall { client.get("time-clock/roster") }
    suspend fun sync(): JsonObject = apiCall { client.post("time-clock/sync") { setBody(JsonObject(emptyMap())) } }
    suspend fun runRoster(): JsonObject = apiCall { client.post("time-clock/roster/run") { setBody(JsonObject(emptyMap())) } }
}

private val ALERT_TEXT = mapOf(
    "UNLINKED" to "Personas en el reloj sin vincular a alguien del sistema",
    "OFFLINE" to "Reloj sin conexión",
    "PENDING_REMOVALS" to "Bajas del reloj por confirmar",
    "REAPPEARED" to "Personas que volvieron a aparecer",
    "SUSPICIOUS" to "Corrida del padrón sospechosa",
)

private fun connectionLabel(c: String) = when (c) {
    "ONLINE", "OK" -> "En línea" to Brand.MintInk
    "NO_RESPONSE", "OFFLINE", "ERROR" -> "Sin conexión" to Brand.Rose
    else -> "Sin datos" to Brand.Muted
}

data class ClocksData(val summary: ClockSummary, val roster: Roster)

class ClocksViewModel(private val api: ClocksApi) : ListViewModel<ClocksData>() {
    override suspend fun fetch() = ClocksData(api.summary(), api.roster())
    fun sync() = act("Sincronización iniciada; las checadas nuevas aparecen en unos segundos.") { api.sync() }
    fun runRoster() = act("Padrón actualizado.") { api.runRoster() }
}

@Composable
fun ColumnScope.ClocksContent(me: Me, vm: ClocksViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    val canSync = me.can("time_clock.sync")
    PillTabs(listOf("Estado", "Padrón"), tab, { tab = it })
    ListFrame(state) { data ->
        val s = data.summary
        if (tab == 0) {
            if (s.alerts.isNotEmpty()) {
                BentoCard(Modifier.fillMaxWidth(), tint = Brand.AmberSoft) {
                    Eyebrow("Alertas", color = Brand.AmberInk)
                    s.alerts.forEach { a -> ListRow(ALERT_TEXT[a.code] ?: a.code, status = "${a.count}", statusColor = Brand.AmberInk, statusTint = Brand.Surface) }
                }
            }
            s.clocks.forEach { c ->
                val (label, color) = connectionLabel(c.connection)
                BentoCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
                        Text(c.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(horizontal = 8.dp))
                        Text(label, color = color, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Kpi("Checadas hoy", "${c.punchesToday}", Modifier.weight(1f))
                        Kpi("Asistencia", if (c.countsAttendance) "Cuenta" else "No cuenta", Modifier.weight(1f))
                    }
                    InfoRow("Serie", c.serial)
                    InfoRow("Última sincronización", c.lastSyncAt?.let { "${it.take(10)} ${timeInZone(it, s.timezone)}" } ?: "—")
                    if (c.lastSyncOk == false) Text("La última lectura falló; revisa que el agente y el reloj estén encendidos y en la misma red.", color = Brand.Rose, fontSize = 12.sp)
                }
            }
            if (s.clocks.isEmpty()) BentoCard(Modifier.fillMaxWidth()) { Text("Tu empresa aún no tiene relojes dados de alta.", color = Brand.Muted) }
            if (canSync) PrimaryButton("Sincronizar ahora", vm::sync, busy = state.busy)
        } else {
            BentoCard(Modifier.fillMaxWidth()) {
                Eyebrow("Padrón del reloj")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Kpi("Sin vincular", "${s.roster.unlinked}", Modifier.weight(1f), accent = Brand.AmberInk)
                    Kpi("Bajas por confirmar", "${s.roster.pendingRemovals}", Modifier.weight(1f), accent = Brand.Rose)
                }
                if (canSync) LinkButton("Correr el padrón ahora", vm::runRoster)
            }
            BentoCard(Modifier.fillMaxWidth()) {
                Eyebrow("En el reloj, sin persona en el sistema")
                if (data.roster.unlinked.isEmpty()) Text("Todos están vinculados.", color = Brand.Muted)
                data.roster.unlinked.forEach { p -> ListRow(p.name, "#${p.employeeNumber} · ${p.clocks.joinToString(", ")}") }
                Text("La vinculación reloj↔persona se hace desde el expediente de cada persona.", color = Brand.Muted, fontSize = 12.sp)
            }
        }
    }
}

// ── Asistencias: rejilla semanal ──────────────────────────────────────────

@Serializable
data class AttendanceDay(val date: String, val status: String, val entryAt: String? = null, val exitAt: String? = null, val lateMin: Int = 0)

@Serializable
data class AttendanceRow(val userId: String, val name: String, val departmentName: String? = null, val scheduleName: String? = null, val days: List<AttendanceDay> = emptyList())

@Serializable
data class AttendanceRange(val days: List<String> = emptyList(), val timezone: String = "America/Mexico_City")

@Serializable
data class AttendanceWeek(val range: AttendanceRange = AttendanceRange(), val rows: List<AttendanceRow> = emptyList())

class AttendanceApi(private val client: HttpClient) {
    suspend fun week(date: String): AttendanceWeek = apiCall { client.post("schedules/weekly-attendance") { setBody(WeekQuery(date)) } }
}

class AttendanceViewModel(private val api: AttendanceApi) : ListViewModel<AttendanceWeek>() {
    var date: String = Clock.System.todayIn(TimeZone.currentSystemDefault()).toString()
        private set
    var query = ""
        private set

    override suspend fun fetch() = api.week(date)

    fun shift(weeks: Int) {
        date = LocalDate.parse(date).let { if (weeks > 0) it.plus(DatePeriod(days = 7)) else it.minus(DatePeriod(days = 7)) }.toString()
        load()
    }

    fun search(q: String) {
        query = q
    }
}

private fun dayCell(status: String): Triple<String, androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color> = when (status) {
    "WORKED" -> Triple("✓", Brand.MintInk, Brand.MintSoft)
    "OVERTIME" -> Triple("+", Brand.AmberInk, Brand.AmberSoft)
    "ABSENCE" -> Triple("F", Brand.Rose, Brand.RoseSoft)
    "INCOMPLETE" -> Triple("½", Brand.AmberInk, Brand.AmberSoft)
    "REST", "REST_WORKED" -> Triple(if (status == "REST_WORKED") "D+" else "D", Brand.Muted, Brand.Paper)
    "FUTURE" -> Triple("·", Brand.Muted, Brand.Surface)
    else -> Triple("?", Brand.Muted, Brand.Paper)
}

@Composable
fun ColumnScope.AttendanceContent(vm: AttendanceViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var q by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(Unit) { vm.load() }
    Row(verticalAlignment = Alignment.CenterVertically) {
        LinkButton("‹ Anterior", { vm.shift(-1) })
        Text("Semana del ${vm.date}", Modifier.weight(1f), color = Brand.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
        LinkButton("Siguiente ›", { vm.shift(1) })
    }
    Field(q, { q = it }, "Buscar por nombre")
    ListFrame(state) { week ->
        BentoCard(Modifier.fillMaxWidth()) {
            Text("✓ trabajó · + con extra · F falta · ½ incompleto · D descanso", color = Brand.Muted, fontSize = 12.sp)
            Row {
                Box(Modifier.weight(2.2f))
                week.range.days.forEach { d ->
                    Text(d.takeLast(2), Modifier.weight(1f), textAlign = TextAlign.Center, color = Brand.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            week.rows.filter { q.isBlank() || it.name.contains(q.trim(), ignoreCase = true) }.sortedBy { it.name }.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 3.dp)) {
                    Row(Modifier.weight(2.2f), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(r.name, 24)
                        Column(Modifier.padding(start = 6.dp)) {
                            val parts = r.name.split(' ')
                            Text(parts[0] + (parts.getOrNull(1)?.firstOrNull()?.let { " $it." } ?: ""), fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            r.departmentName?.let { Text(it, fontSize = 10.5.sp, color = Brand.Muted, maxLines = 1) }
                        }
                    }
                    week.range.days.forEach { d ->
                        val day = r.days.firstOrNull { it.date == d }
                        val (text, color, tint) = dayCell(day?.status ?: "NO_INFO")
                        Text(
                            text + if ((day?.lateMin ?: 0) > 0) "'" else "",
                            Modifier.weight(1f).padding(horizontal = 1.dp).clip(RoundedCornerShape(6.dp)).background(tint).padding(vertical = 5.dp),
                            textAlign = TextAlign.Center,
                            color = color,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            Text("Un apóstrofo (') marca retardo.", color = Brand.Muted, fontSize = 11.sp)
        }
    }
}
