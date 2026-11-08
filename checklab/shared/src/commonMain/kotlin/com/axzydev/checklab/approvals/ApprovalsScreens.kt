package com.axzydev.checklab.approvals

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.time.formatMinutes
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.ButtonPair
import com.axzydev.checklab.design.CardSkeleton
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.home.Slot
import com.axzydev.checklab.navigation.Avatar
import com.axzydev.checklab.nom.LEAVE_STATUS
import com.axzydev.checklab.nom.LeaveRequestRow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import org.koin.compose.viewmodel.koinViewModel

/** Estado común de una lista que se carga, se filtra y tiene acciones. */
data class ListState<T>(
    val items: Slot<T> = Slot.Loading,
    val busy: Boolean = false,
    val notice: String? = null,
    val error: String? = null,
)

/** Base de las pantallas de lista: carga con su filtro, acciones con aviso y recarga. */
abstract class ListViewModel<T> : ViewModel() {
    protected val _state = MutableStateFlow(ListState<T>())
    val state: StateFlow<ListState<T>> = _state.asStateFlow()

    protected abstract suspend fun fetch(): T

    fun load() {
        viewModelScope.launch {
            val r = try {
                Slot.Ready(fetch())
            } catch (e: ApiException) {
                Slot.Failed(e.message)
            }
            _state.update { it.copy(items = r) }
        }
    }

    protected fun act(done: String?, block: suspend () -> Unit) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, notice = null, error = null) }
        viewModelScope.launch {
            try {
                block()
                _state.update { it.copy(notice = done) }
                load()
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }
}

@Composable
fun <T> ColumnScope.ListFrame(state: ListState<T>, content: @Composable ColumnScope.(T) -> Unit) {
    state.notice?.let { Notice(it, error = false) }
    state.error?.let { Notice(it) }
    when (val s = state.items) {
        Slot.Hidden -> Unit
        Slot.Loading -> {
            CardSkeleton(Modifier.fillMaxWidth())
            CardSkeleton(Modifier.fillMaxWidth())
        }
        is Slot.Failed -> Notice(s.message)
        is Slot.Ready -> content(s.value)
    }
}

// ── Notificaciones ────────────────────────────────────────────────────────

/** "1 notificación", "3 notificaciones": el plural pierde la tilde. */
fun notificationsCount(n: Int): String = if (n == 1) "1 notificación" else "$n notificaciones"

class NotificationsViewModel(private val api: ApprovalsApi, private val unread: UnreadCounter) : ListViewModel<List<Notification>>() {
    var unreadOnly = false
        private set

    override suspend fun fetch() = api.notifications(unreadOnly).data

    fun filter(unread: Boolean) {
        unreadOnly = unread
        load()
    }

    fun read(id: String) = act(null) { api.markRead(id); unread.refresh() }
    fun readAll() = act("Todas quedaron leídas.") { api.markAllRead(); unread.refresh() }
    fun delete(id: String) = act("Notificación borrada.") { api.deleteNotification(id); unread.refresh() }
}

@Composable
fun ColumnScope.NotificationsContent(vm: NotificationsViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    PillTabs(listOf("Todas", "Sin leer"), tab, { tab = it; vm.filter(it == 1) })
    ListFrame(state) { list ->
        BentoCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Eyebrow(notificationsCount(list.size)) }
                if (list.any { !it.read }) LinkButton("Marcar todas como leídas", vm::readAll)
            }
            if (list.isEmpty()) Text("No tienes notificaciones.", color = Brand.Muted)
            list.forEach { n ->
                ListRow(
                    title = n.title,
                    detail = "${n.detail.orEmpty()}\n${n.createdAt.take(10)}",
                    status = if (n.read) null else "Nueva",
                    statusColor = Brand.MintInk,
                    statusTint = Brand.MintSoft,
                    leading = {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(if (n.read) Brand.Line else Brand.Mint))
                    },
                    onClick = { if (!n.read) vm.read(n.id) },
                )
                Text(
                    "Borrar",
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { vm.delete(n.id) }.padding(horizontal = 4.dp, vertical = 2.dp),
                    color = Brand.Muted,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

// ── Tiempo extra (aprobación por día) ─────────────────────────────────────

class OvertimeApprovalViewModel(private val api: ApprovalsApi, today: () -> kotlinx.datetime.LocalDate) : ListViewModel<OvertimePage>() {
    var status = "PENDING"
        private set
    var date: String = today().toString()
        private set

    override suspend fun fetch() = api.overtime(date, status)

    fun show(status: String) {
        this.status = status
        load()
    }

    fun shiftWeek(weeks: Int) {
        date = LocalDate.parse(date).let { if (weeks > 0) it.plus(DatePeriod(days = 7)) else it.minus(DatePeriod(days = 7)) }.toString()
        load()
    }

    fun decide(items: List<OvertimeDay>, approve: Boolean, note: String?) =
        act(if (approve) "Tiempo extra aprobado (${items.size})." else "Tiempo extra rechazado (${items.size}).") {
            api.decideOvertime(date, items.map { OvertimeItem(it.userId, it.date) }, approve, note)
        }
}

@Composable
fun ColumnScope.OvertimeApprovalContent(me: Me, vm: OvertimeApprovalViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    val selected = remember { mutableStateListOf<String>() }
    var note by remember { mutableStateOf("") }
    val canApprove = me.can("overtime.approve")
    LaunchedEffect(Unit) { vm.load() }

    Row(verticalAlignment = Alignment.CenterVertically) {
        LinkButton("‹ Semana anterior", { selected.clear(); vm.shiftWeek(-1) })
        Text("Semana del ${vm.date}", Modifier.weight(1f), color = Brand.Muted, fontSize = 13.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        LinkButton("Siguiente ›", { selected.clear(); vm.shiftWeek(1) })
    }
    PillTabs(listOf("Por aprobar", "Aprobado", "Rechazado"), tab, {
        tab = it
        selected.clear()
        vm.show(listOf("PENDING", "APPROVED", "REJECTED")[it])
    })
    ListFrame(state) { page ->
        val s = page.summary
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Resumen de la semana")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Por aprobar", formatMinutes(s.pendingMinutes), Modifier.weight(1f), accent = Brand.AmberInk, tint = Brand.AmberSoft)
                Kpi("Aprobado", formatMinutes(s.approvedMinutes), Modifier.weight(1f), accent = Brand.MintInk, tint = Brand.MintSoft)
            }
            Text("${s.peopleWithPending} persona${if (s.peopleWithPending == 1) "" else "s"} con días pendientes · ${s.pendingDays} días", color = Brand.Muted, fontSize = 13.sp)
        }
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Días")
            if (page.data.isEmpty()) Text("Nada en esta vista.", color = Brand.Muted)
            page.data.forEach { d ->
                val key = "${d.userId}|${d.date}"
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (canApprove && vm.status == "PENDING") {
                        Checkbox(
                            checked = key in selected,
                            onCheckedChange = { if (it) selected += key else selected -= key },
                            colors = CheckboxDefaults.colors(checkedColor = Brand.MintInk),
                        )
                    }
                    Box(Modifier.weight(1f)) {
                        ListRow(
                            title = d.employeeName,
                            detail = "${d.date} · trabajó ${formatMinutes(d.workedMin)} de ${formatMinutes(d.scheduledMin)}${d.shift?.let { " · $it" } ?: ""}${d.departmentName?.let { " · $it" } ?: ""}",
                            status = "+${formatMinutes(d.extraMin)}",
                            statusColor = Brand.AmberInk,
                            statusTint = Brand.AmberSoft,
                            leading = { Avatar(d.employeeName, 30) },
                        )
                    }
                }
            }
            if (canApprove && vm.status == "PENDING" && page.data.isNotEmpty()) {
                Text(
                    if (selected.size == page.data.size) "Quitar selección" else "Seleccionar todo",
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) {
                        if (selected.size == page.data.size) selected.clear() else { selected.clear(); selected.addAll(page.data.map { "${it.userId}|${it.date}" }) }
                    }.padding(4.dp),
                    color = Brand.MintInk,
                    fontWeight = FontWeight.SemiBold,
                )
                if (selected.isNotEmpty()) {
                    Field(note, { note = it }, "Nota (obligatoria si rechazas)")
                    val chosen = page.data.filter { "${it.userId}|${it.date}" in selected }
                    ButtonPair(
                        "Aprobar ${chosen.size}",
                        { vm.decide(chosen, true, note); selected.clear(); note = "" },
                        "Rechazar",
                        { if (note.isNotBlank()) { vm.decide(chosen, false, note); selected.clear(); note = "" } },
                        state.busy,
                    )
                }
            }
            if (!canApprove) Text("Puedes consultar el tiempo extra; aprobarlo requiere el permiso de aprobación.", color = Brand.Muted, fontSize = 12.sp)
        }
    }
}

// ── Vacaciones y permisos (RH) ────────────────────────────────────────────

class LeaveApprovalViewModel(private val api: ApprovalsApi) : ListViewModel<List<LeaveRequestRow>>() {
    var status: String? = "PENDING"
        private set

    override suspend fun fetch() = api.leaveRequests(status)

    fun show(status: String?) {
        this.status = status
        load()
    }

    fun decide(id: String, approve: Boolean, note: String?) =
        act(if (approve) "Solicitud aprobada." else "Solicitud rechazada.") { api.decideLeave(id, approve, note) }
}

@Composable
fun ColumnScope.LeaveApprovalContent(me: Me, vm: LeaveApprovalViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    val canDecide = me.can("time_clock.write")
    PillTabs(listOf("Pendientes", "Aprobadas", "Rechazadas", "Todas"), tab, {
        tab = it
        vm.show(listOf("PENDING", "APPROVED", "REJECTED", null)[it])
    })
    ListFrame(state) { list ->
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("${list.size} solicitud${if (list.size == 1) "" else "es"}")
            if (list.isEmpty()) Text("No hay solicitudes en esta vista.", color = Brand.Muted)
            list.forEach { r -> LeaveRow(r, canDecide, state.busy, vm) }
        }
    }
}

@Composable
private fun LeaveRow(r: LeaveRequestRow, canDecide: Boolean, busy: Boolean, vm: LeaveApprovalViewModel) {
    var note by remember(r.id) { mutableStateOf("") }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ListRow(
            title = "${r.user?.name ?: "Persona"} · ${r.type.name}",
            detail = "${r.startDate.take(10)} al ${r.endDate.take(10)} · ${r.days} día${if (r.days == 1) "" else "s"}${r.reason?.let { "\n$it" } ?: ""}",
            status = LEAVE_STATUS[r.status] ?: r.status,
            statusColor = when (r.status) { "APPROVED" -> Brand.MintInk; "PENDING" -> Brand.AmberInk; "REJECTED" -> Brand.Rose; else -> Brand.Muted },
            statusTint = when (r.status) { "APPROVED" -> Brand.MintSoft; "PENDING" -> Brand.AmberSoft; "REJECTED" -> Brand.RoseSoft; else -> Brand.Surface },
            leading = { Avatar(r.user?.name ?: r.id, 30) },
        )
        if (canDecide && r.status == "PENDING") {
            Field(note, { note = it }, "Nota para la persona (opcional)")
            ButtonPair("Aprobar", { vm.decide(r.id, true, note) }, "Rechazar", { vm.decide(r.id, false, note) }, busy)
        }
        Spacer(Modifier.width(1.dp))
    }
}

/**
 * Avisos sin leer de la pestaña "Avisos". Uno por sesión (single en Koin) para que la barra
 * y la pantalla de notificaciones compartan el número; si la consulta falla, queda el último valor.
 */
class UnreadCounter(private val api: ApprovalsApi) {
    private val _count = MutableStateFlow(0)
    val count: StateFlow<Int> = _count.asStateFlow()

    suspend fun refresh() {
        try {
            _count.value = api.unreadCount()
        } catch (_: ApiException) {
        }
    }
}
