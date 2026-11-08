package com.axzydev.checklab.schedules

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
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
import com.axzydev.checklab.design.DateField
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.navigation.Avatar
import com.axzydev.checklab.people.PeopleApi
import com.axzydev.checklab.people.Person
import com.axzydev.checklab.people.TableQuery
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.koin.compose.viewmodel.koinViewModel

@Serializable
data class ScheduleDay(
    val weekday: Int,
    val startTime: String? = null,
    val endTime: String? = null,
    val splitStartTime: String? = null,
    val splitEndTime: String? = null,
    val restDay: Boolean = false,
)

@Serializable
data class Schedule(
    val id: String,
    val name: String,
    val active: Boolean = true,
    val entryToleranceMin: Int = 10,
    val exitToleranceMin: Int = 10,
    val mealBreakMin: Int = 30,
    val minOvertimeMin: Int = 30,
    val crossesMidnight: Boolean = false,
    val days: List<ScheduleDay> = emptyList(),
    val assigned: Int? = null,
)

@Serializable
data class ScheduleInput(
    val name: String,
    val entryToleranceMin: Int,
    val exitToleranceMin: Int,
    val mealBreakMin: Int,
    val minOvertimeMin: Int,
    val crossesMidnight: Boolean,
    val days: List<ScheduleDay>,
)

@Serializable
data class ActiveOnly(val active: Boolean)

@Serializable
data class AssignInput(val scheduleId: String, val userIds: List<String>, val from: String)

@Serializable
data class RemoveInput(val scheduleId: String, val userIds: List<String>)

@Serializable
data class AssignmentRow(
    val userId: String,
    val employeeName: String,
    val employeeNumber: String? = null,
    val departmentName: String? = null,
    val scheduleId: String,
    val scheduleName: String,
    val from: String? = null,
)

@Serializable
data class AssignmentPage(val data: List<AssignmentRow> = emptyList(), val total: Int = 0)

class SchedulesApi(private val client: HttpClient) {
    suspend fun list(): List<Schedule> = apiCall { client.get("schedules") { parameter("includeInactive", "true") } }
    suspend fun create(input: ScheduleInput): JsonObject = apiCall { client.post("schedules") { setBody(input) } }
    suspend fun update(id: String, input: ScheduleInput): JsonObject = apiCall { client.patch("schedules/$id") { setBody(input) } }
    suspend fun setActive(id: String, active: Boolean): JsonObject = apiCall { client.patch("schedules/$id") { setBody(ActiveOnly(active)) } }
    suspend fun assign(input: AssignInput): JsonObject = apiCall { client.post("schedules/assignments") { setBody(input) } }
    suspend fun remove(input: RemoveInput): JsonObject = apiCall { client.post("schedules/assignments/remove") { setBody(input) } }
    suspend fun assignments(scheduleId: String?): AssignmentPage =
        apiCall {
            client.post("schedules/assignments/query") {
                setBody(TableQuery(1, 200, scheduleId?.let { mapOf("scheduleId" to JsonPrimitive(it)) } ?: emptyMap()))
            }
        }
}

private val WEEKDAYS = listOf("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")

fun ScheduleDay.text(): String = when {
    restDay || startTime == null -> "Descanso"
    splitStartTime != null && splitEndTime != null -> "$startTime-$endTime / $splitStartTime-$splitEndTime"
    else -> "$startTime-$endTime"
}

/** Horas por semana del horario (sin restar comida), como referencia rápida. */
fun Schedule.weeklyHours(): Double = days.filter { !it.restDay && it.startTime != null && it.endTime != null }.sumOf { d ->
    fun min(t: String) = t.substringBefore(':').toInt() * 60 + t.substringAfter(':').toInt()
    var m = min(d.endTime!!) - min(d.startTime!!)
    if (m < 0) m += 24 * 60
    if (d.splitStartTime != null && d.splitEndTime != null) m += (min(d.splitEndTime) - min(d.splitStartTime))
    m / 60.0
}

class SchedulesViewModel(private val api: SchedulesApi) : ListViewModel<List<Schedule>>() {
    override suspend fun fetch() = api.list()
    fun save(id: String?, input: ScheduleInput, onDone: () -> Unit) = act(if (id == null) "Horario creado." else "Horario guardado.") {
        if (id == null) api.create(input) else api.update(id, input)
        onDone()
    }
    fun toggle(s: Schedule) = act(if (s.active) "Horario desactivado." else "Horario activado.") { api.setActive(s.id, !s.active) }
}

@Composable
private fun WeekStrip(s: Schedule) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        (1..7).forEach { wd ->
            val d = s.days.firstOrNull { it.weekday == wd }
            val rest = d == null || d.restDay || d.startTime == null
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (rest) Brand.Paper else Brand.MintSoft).padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(WEEKDAYS[wd - 1], fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (rest) Brand.Muted else Brand.MintInk)
                Text(if (rest) "—" else d!!.startTime!!.removeSuffix(":00"), fontSize = 11.sp, color = Brand.Ink)
            }
        }
    }
}

@Composable
fun ColumnScope.SchedulesContent(me: Me, vm: SchedulesViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { vm.load() }
    val canManage = me.can("schedules.manage")

    ListFrame(state) { list ->
        val target = editing
        if (target != null) {
            ScheduleEditor(list.firstOrNull { it.id == target }, state.busy, vm) { editing = null }
            return@ListFrame
        }
        if (canManage) LinkButton("+ Nuevo horario", { editing = "" })
        list.sortedByDescending { it.active }.forEach { s ->
            BentoCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(s.name, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = if (s.active) Brand.Ink else Brand.Muted)
                        Text(
                            "${formatMinutes((s.weeklyHours() * 60).toInt())}/sem · comida ${s.mealBreakMin} min · tolerancia ${s.entryToleranceMin} min${if (s.crossesMidnight) " · nocturno" else ""}",
                            color = Brand.Muted,
                            fontSize = 12.5.sp,
                        )
                    }
                    if (!s.active) Text("Inactivo", color = Brand.Muted, fontSize = 12.sp)
                }
                WeekStrip(s)
                if (canManage) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LinkButton("Editar", { editing = s.id })
                        LinkButton(if (s.active) "Desactivar" else "Activar", { vm.toggle(s) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.ScheduleEditor(original: Schedule?, busy: Boolean, vm: SchedulesViewModel, onClose: () -> Unit) {
    val state by vm.state.collectAsState()
    var name by remember { mutableStateOf(original?.name ?: "") }
    var meal by remember { mutableStateOf((original?.mealBreakMin ?: 30).toString()) }
    var tolerance by remember { mutableStateOf((original?.entryToleranceMin ?: 10).toString()) }
    var minOt by remember { mutableStateOf((original?.minOvertimeMin ?: 30).toString()) }
    var night by remember { mutableStateOf(original?.crossesMidnight ?: false) }
    val days = remember {
        mutableStateListOf<ScheduleDay>().apply {
            (1..7).forEach { wd -> add(original?.days?.firstOrNull { it.weekday == wd } ?: ScheduleDay(wd, "09:00", "18:00", restDay = wd == 7)) }
        }
    }
    val hhmm = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")
    val valid = name.isNotBlank() && days.all { it.restDay || (it.startTime?.matches(hhmm) == true && it.endTime?.matches(hhmm) == true) } && days.any { it.restDay }

    LinkButton("‹ Volver a horarios", onClose)
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow(if (original == null) "Nuevo horario" else "Editar horario")
        Field(name, { name = it }, "Nombre del horario")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Field(meal, { meal = it.filter(Char::isDigit) }, "Comida (min)", Modifier.weight(1f))
            Field(tolerance, { tolerance = it.filter(Char::isDigit) }, "Tolerancia", Modifier.weight(1f))
            Field(minOt, { minOt = it.filter(Char::isDigit) }, "Mín. extra", Modifier.weight(1f))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Turno nocturno (cruza medianoche)", Modifier.weight(1f), fontSize = 14.sp)
            Switch(night, { night = it }, colors = SwitchDefaults.colors(checkedTrackColor = Brand.MintInk))
        }
        days.forEachIndexed { i, d ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(WEEKDAYS[i], Modifier.weight(0.6f), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                if (d.restDay) {
                    Text("Descanso", Modifier.weight(2f), color = Brand.Muted)
                } else {
                    Field(d.startTime ?: "", { days[i] = d.copy(startTime = it.take(5)) }, "Entrada", Modifier.weight(1f))
                    Field(d.endTime ?: "", { days[i] = d.copy(endTime = it.take(5)) }, "Salida", Modifier.weight(1f))
                }
                Text(
                    if (d.restDay) "Trabaja" else "Descansa",
                    modifier = Modifier.weight(0.8f).clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button) {
                        days[i] = if (d.restDay) d.copy(restDay = false, startTime = "09:00", endTime = "18:00") else d.copy(restDay = true, startTime = null, endTime = null)
                    }.padding(vertical = 8.dp),
                    color = Brand.MintInk,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Text("Formato 24 h (07:00). La ley pide al menos un día de descanso; el servidor valida topes y jornada nocturna.", color = Brand.Muted, fontSize = 12.sp)
        state.error?.let { Notice(it) }
        PrimaryButton(
            "Guardar horario",
            {
                vm.save(
                    original?.id,
                    ScheduleInput(
                        name.trim(), tolerance.toIntOrNull() ?: 10, tolerance.toIntOrNull() ?: 10, meal.toIntOrNull() ?: 30,
                        minOt.toIntOrNull() ?: 30, night, days.toList(),
                    ),
                    onClose,
                )
            },
            enabled = valid,
            busy = busy,
        )
        if (original?.assigned?.let { it > 0 } == true) {
            Text("Este horario lo usan ${original.assigned} personas: el cambio aplica a todas.", color = Brand.AmberInk, fontSize = 12.sp)
        }
    }
}

// ── Asignación ────────────────────────────────────────────────────────────

data class AssignData(val schedules: List<Schedule>, val assigned: List<AssignmentRow>, val people: List<Person>)

class AssignViewModel(private val api: SchedulesApi, private val people: PeopleApi) : ListViewModel<AssignData>() {
    var scheduleId: String? = null
        private set
    var query = ""
        private set

    override suspend fun fetch(): AssignData {
        val schedules = api.list().filter { it.active }
        val target = scheduleId ?: schedules.firstOrNull()?.id
        scheduleId = target
        val all = api.assignments(null).data
        return AssignData(schedules, all, people.people(query, true).data)
    }

    fun pick(id: String) {
        scheduleId = id
        load()
    }

    fun search(q: String) {
        query = q
        load()
    }

    fun assign(userIds: List<String>, from: String) =
        act("Horario asignado a ${userIds.size} persona${if (userIds.size == 1) "" else "s"}.") { api.assign(AssignInput(scheduleId!!, userIds, from)) }

    fun remove(userId: String) = act("Asignación quitada.") { api.remove(RemoveInput(scheduleId!!, listOf(userId))) }
}

@Composable
fun ColumnScope.AssignContent(me: Me, vm: AssignViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    val selected = remember { mutableStateListOf<String>() }
    var q by rememberSaveable { mutableStateOf("") }
    var from by rememberSaveable { mutableStateOf(com.axzydev.checklab.core.time.tenantToday(me.tenant?.timezone).toString()) }
    LaunchedEffect(Unit) { vm.load() }
    val canManage = me.can("schedules.manage")

    ListFrame(state) { data ->
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Horario")
            data.schedules.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { s ->
                        val on = s.id == vm.scheduleId
                        Text(
                            s.name,
                            modifier = Modifier.weight(1f).clip(RoundedCornerShape(999.dp)).background(if (on) Brand.Navy else Brand.Paper)
                                .clickable(role = Role.RadioButton) { selected.clear(); vm.pick(s.id) }.padding(vertical = 9.dp, horizontal = 8.dp),
                            color = if (on) Brand.Paper else Brand.Ink,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                        )
                    }
                    if (row.size == 1) androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
            }
        }
        val current = data.assigned.associateBy { it.userId }
        val inSchedule = data.assigned.filter { it.scheduleId == vm.scheduleId }
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Con este horario · ${inSchedule.size}")
            if (inSchedule.isEmpty()) Text("Nadie tiene este horario todavía.", color = Brand.Muted)
            inSchedule.forEach { a ->
                ListRow(a.employeeName, listOfNotNull(a.departmentName, a.from?.take(10)?.let { "desde $it" }).joinToString(" · "), leading = { Avatar(a.employeeName, 28) })
                if (canManage) LinkButton("Quitar a ${a.employeeName.substringBefore(' ')}", { vm.remove(a.userId) })
            }
        }
        if (canManage) {
            BentoCard(Modifier.fillMaxWidth()) {
                Eyebrow("Asignar personas")
                Field(q, { q = it; vm.search(it) }, "Buscar por nombre")
                data.people.filter { current[it.id]?.scheduleId != vm.scheduleId }.take(30).forEach { p ->
                    val other = current[p.id]
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(p.id in selected, { if (it) selected += p.id else selected -= p.id }, colors = CheckboxDefaults.colors(checkedColor = Brand.MintInk))
                        androidx.compose.foundation.layout.Box(Modifier.weight(1f)) {
                            ListRow(
                                p.name,
                                if (other != null) "Hoy tiene «${other.scheduleName}»: se reemplaza" else (p.department?.name ?: "Sin horario"),
                                status = if (other != null) "Reemplazo" else null,
                                statusColor = Brand.AmberInk,
                                statusTint = Brand.AmberSoft,
                            )
                        }
                    }
                }
                DateField("Vigente desde", from, { from = it })
                PrimaryButton("Asignar a ${selected.size}", { vm.assign(selected.toList(), from); selected.clear() }, enabled = selected.isNotEmpty(), busy = state.busy)
                Text("Cada persona tiene una sola asignación vigente: la nueva cierra la anterior.", color = Brand.Muted, fontSize = 12.sp)
            }
        }
    }
}
