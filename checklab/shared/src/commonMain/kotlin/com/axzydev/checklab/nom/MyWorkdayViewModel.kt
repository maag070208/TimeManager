package com.axzydev.checklab.nom

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.location.LocationProvider
import com.axzydev.checklab.core.location.LocationResult
import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.storage.SecureStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.todayIn
import kotlin.time.Clock
import kotlin.time.Instant

data class MyWorkdayState(
    val loading: Boolean = true,
    /** Marcajes de hoy, del más viejo al más reciente. */
    val today: List<MyPunch> = emptyList(),
    /** Últimos 14 días, del más reciente al más viejo. */
    val history: List<MyPunch> = emptyList(),
    val pending: List<PunchRequest> = emptyList(),
    val workMode: WorkMode = WorkMode.PRESENCIAL,
    val note: String = "",
    val shareLocation: Boolean = true,
    val busy: Boolean = false,
    val notice: String? = null,
    val error: String? = null,
) {
    /** Tipos de hoy, contando lo que espera en la cola: el siguiente paso no se repite sin red. */
    val todayTypes: List<PunchType>
        get() = today.filter { it.source == "REMOTE" }.mapNotNull { it.type } + pending.map { it.type }

    val next: List<PunchType> get() = nextPunchTypes(todayTypes)

    fun timeOf(type: PunchType): MyPunch? = today.lastOrNull { it.source == "REMOTE" && it.type == type }

    val lastLocated: MyPunch? get() = history.firstOrNull { it.latitude != null && it.longitude != null }
}

/**
 * Portal del trabajador: checar con o sin red, con la ubicación del momento,
 * y ver sus marcajes. Las reglas viven en el API; aquí solo se muestran.
 */
class MyWorkdayViewModel(private val api: NomApi, private val store: SecureStore) : ViewModel() {
    private val _state = MutableStateFlow(MyWorkdayState())
    val state: StateFlow<MyWorkdayState> = _state.asStateFlow()

    private var queue: PunchQueue? = null
    private var timezone = TimeZone.of("America/Mexico_City")

    fun start(me: Me) {
        timezone = me.tenant?.timezone?.let { runCatching { TimeZone.of(it) }.getOrNull() } ?: timezone
        queue = PunchQueue(store, api, me.id)
        refresh()
    }

    fun refresh() {
        val q = queue ?: return
        viewModelScope.launch {
            _state.update { it.copy(loading = it.history.isEmpty(), pending = q.pending()) }
            val rejected = q.flush()
            try {
                val todayKey = Clock.System.todayIn(timezone)
                val from = todayKey.minus(DatePeriod(days = 13))
                val history = api.myPunches(from = from.toString(), to = todayKey.toString(), limit = 300)
                    .sortedByDescending { it.occurredAt }
                val today = history.filter { dayOf(it.occurredAt) == todayKey.toString() }.sortedBy { it.occurredAt }
                _state.update {
                    it.copy(
                        loading = false,
                        today = today,
                        history = history,
                        pending = q.pending(),
                        error = rejected.firstOrNull()?.let { e -> "Una checada guardada sin red no se aceptó: ${e.message}" },
                    )
                }
            } catch (e: ApiException) {
                _state.update { it.copy(loading = false, pending = q.pending(), error = if (e.isNetwork) null else e.message) }
            }
        }
    }

    fun onWorkMode(mode: WorkMode) = _state.update { it.copy(workMode = mode) }
    fun onNote(value: String) = _state.update { it.copy(note = value.take(500)) }
    fun onShareLocation(value: Boolean) = _state.update { it.copy(shareLocation = value) }
    fun dismiss() = _state.update { it.copy(notice = null, error = null) }

    fun punch(type: PunchType, location: LocationProvider) {
        val q = queue ?: return
        val s = _state.value
        if (s.busy || type !in s.next) return
        _state.update { it.copy(busy = true, notice = null, error = null) }
        viewModelScope.launch {
            try {
                var locationNote: String? = null
                val fix = if (s.shareLocation) {
                    when (val r = location.current()) {
                        is LocationResult.Found -> r.fix
                        LocationResult.Denied -> null.also { locationNote = "sin ubicación (no diste permiso)" }
                        LocationResult.Unavailable -> null.also { locationNote = "sin ubicación (no hubo señal)" }
                    }
                } else {
                    null
                }
                val request = PunchRequest(
                    type = type,
                    workMode = s.workMode,
                    latitude = fix?.latitude,
                    longitude = fix?.longitude,
                    gpsAccuracyMeters = fix?.accuracyMeters,
                    note = s.note.trim().takeIf { it.isNotEmpty() },
                )
                val notice = when (val outcome = q.punch(request)) {
                    is PunchOutcome.Sent -> "${type.label} registrada a las ${timeOf(outcome.punch.occurredAt)}"
                    is PunchOutcome.Queued -> "${type.label} guardada sin conexión; se enviará sola (${outcome.pending} pendiente${if (outcome.pending > 1) "s" else ""})"
                }
                _state.update { it.copy(note = "", notice = listOfNotNull(notice, locationNote).joinToString(" · ")) }
                refresh()
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }

    fun reportDiscrepancy(punchId: String, reason: String, onDone: () -> Unit) {
        if (reason.trim().length < 5) {
            _state.update { it.copy(error = "Explica el motivo con al menos 5 caracteres.") }
            return
        }
        viewModelScope.launch {
            try {
                api.reportDiscrepancy(punchId, reason.trim())
                _state.update { it.copy(notice = "Discrepancia enviada a Recursos Humanos.", error = null) }
                onDone()
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            }
        }
    }

    fun timeOf(iso: String): String = runCatching {
        val t = Instant.parse(iso).toLocalDateTime(timezone)
        "${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}"
    }.getOrDefault("—")

    fun dayOf(iso: String): String = runCatching { Instant.parse(iso).toLocalDateTime(timezone).date.toString() }.getOrDefault("")

    /** "Hoy", "Ayer" o "vie 6 nov", en la zona del cliente. */
    fun dayLabel(dateKey: String): String = runCatching {
        val date = LocalDate.parse(dateKey)
        val today = Clock.System.todayIn(timezone)
        when (date) {
            today -> "Hoy"
            today.minus(DatePeriod(days = 1)) -> "Ayer"
            else -> "${WEEKDAYS[date.dayOfWeek.ordinal]} ${date.day} ${MONTHS[date.month.ordinal]}"
        }
    }.getOrDefault(dateKey)

    private companion object {
        val WEEKDAYS = listOf("lun", "mar", "mié", "jue", "vie", "sáb", "dom")
        val MONTHS = listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
    }
}
