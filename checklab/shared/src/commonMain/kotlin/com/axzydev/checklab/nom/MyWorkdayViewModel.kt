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
    /** El cliente puede apagar la ubicación: entonces ni se pide ni se muestra. */
    val geoEnabled: Boolean = true,
    /** El cliente puede apagar la comida: entonces solo hay entrada y salida. */
    val lunchEnabled: Boolean = true,
    /** Falso si la persona checa solo en el reloj o el cliente apagó la checada desde la app. */
    val canPunch: Boolean = true,
    /** Canales de checada del cliente (`WEB`/`APP`/`CLOCK`); vacío si el API no los manda. */
    val punchChannels: List<String> = emptyList(),
    /** Falta aceptar el acuerdo de método de registro: el botón acepta y checa en un toque. */
    val agreementPending: Boolean = false,
    val agreementProposal: RecordProposal? = null,
    val busy: Boolean = false,
    val notice: String? = null,
    val error: String? = null,
) {
    /** Tipos de hoy, contando lo que espera en la cola: el siguiente paso no se repite sin red. */
    val todayTypes: List<PunchType>
        get() = today.filter { it.source == "REMOTE" }.mapNotNull { it.type } + pending.map { it.type }

    val next: List<PunchType> get() = nextPunchTypes(todayTypes, lunchEnabled)

    fun timeOf(type: PunchType): MyPunch? = today.lastOrNull { it.source == "REMOTE" && it.type == type }

    val lastLocated: MyPunch? get() = history.firstOrNull { it.latitude != null && it.longitude != null }

    /** Qué decir cuando la app no puede checar: dónde sí puede y que aquí solo consulta. */
    val readOnlyNotice: PunchReadOnlyNotice get() = punchReadOnlyNotice(punchChannels)
}

/** Aviso de solo lectura del panel de checada (canal APP apagado por el cliente). */
data class PunchReadOnlyNotice(val title: String, val detail: String)

/**
 * Si la app puede checar según los canales que ya trae la sesión (`/auth/me`),
 * para no mostrar el botón mientras llega `/nom/me/telework`. `null` si la
 * sesión no trae canales (API anterior): no se puede deducir.
 */
fun canPunchAppFromChannels(channels: List<String>): Boolean? =
    if (channels.isEmpty()) null else "APP" in channels

/**
 * Aviso cuando la app no puede checar, según los canales del cliente: si hay
 * reloj se le remite a él (como antes); si solo hay web, a la web; si el
 * cliente apagó la checada remota, se le dice tal cual.
 */
fun punchReadOnlyNotice(channels: List<String>): PunchReadOnlyNotice = when {
    channels.isEmpty() || "CLOCK" in channels -> PunchReadOnlyNotice(
        title = "Checas en el reloj",
        detail = "Tu empresa registra tu jornada con el reloj checador. Aquí ves tus marcajes y puedes reportar si algo no coincide.",
    )
    "WEB" in channels -> PunchReadOnlyNotice(
        title = "Checas desde la web",
        detail = "Tu empresa no permite checar desde la app móvil. Registra tu checada desde la web; aquí ves tus marcajes y puedes reportar si algo no coincide.",
    )
    else -> PunchReadOnlyNotice(
        title = "Checada remota deshabilitada",
        detail = "Tu empresa no permite checar desde la app en este momento. Aquí ves tus marcajes y puedes reportar si algo no coincide.",
    )
}

/**
 * Portal del trabajador: checar con o sin red, con la ubicación del momento,
 * y ver sus marcajes. Las reglas viven en el API; aquí solo se muestran.
 */
class MyWorkdayViewModel(
    private val api: NomApi,
    private val store: SecureStore,
    private val worker: WorkerApi,
) : ViewModel() {
    private val _state = MutableStateFlow(MyWorkdayState())
    val state: StateFlow<MyWorkdayState> = _state.asStateFlow()

    private var queue: PunchQueue? = null
    private var timezone = TimeZone.of("America/Mexico_City")

    fun start(me: Me) {
        timezone = me.tenant?.timezone?.let { runCatching { TimeZone.of(it) }.getOrNull() } ?: timezone
        queue = PunchQueue(store, api, me.id)
        // La sesión ya trae los canales del cliente: si no hay APP, se oculta la
        // checada desde el inicio, sin esperar a `/nom/me/telework`.
        val tenantChannels = me.tenant?.punchChannels.orEmpty()
        val tenantCanPunch = canPunchAppFromChannels(tenantChannels)
        if (tenantCanPunch != null) {
            _state.update { it.copy(punchChannels = tenantChannels, canPunch = it.canPunch && tenantCanPunch) }
        }
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
                val settings = runCatching { api.punchSettings() }.getOrNull()
                val agreementPending = settings?.remoteAgreementPending == true
                val proposal = if (agreementPending) runCatching { worker.recordProposal() }.getOrNull() else null
                _state.update {
                    it.copy(
                        loading = false,
                        today = today,
                        history = history,
                        geoEnabled = settings?.remoteGeolocationEnabled ?: it.geoEnabled,
                        lunchEnabled = settings?.lunchPunchEnabled ?: it.lunchEnabled,
                        canPunch = settings?.canPunchFromApp ?: it.canPunch,
                        agreementPending = settings?.remoteAgreementPending ?: it.agreementPending,
                        agreementProposal = proposal ?: it.agreementProposal,
                        punchChannels = settings?.punchChannels?.takeIf { channels -> channels.isNotEmpty() } ?: it.punchChannels,
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

    /** Un toque: acepta el acuerdo de método y registra el siguiente paso. */
    fun acceptAgreementAndPunch(location: LocationProvider) {
        val s = _state.value
        val proposal = s.agreementProposal ?: return
        if (s.busy) return
        _state.update { it.copy(busy = true, notice = null, error = null) }
        viewModelScope.launch {
            try {
                worker.acceptRecordAgreement(proposal)
                _state.update { it.copy(busy = false, agreementPending = false) }
                _state.value.next.firstOrNull()?.let { punch(it, location) }
            } catch (e: ApiException) {
                _state.update { it.copy(busy = false, error = e.message) }
            }
        }
    }

    fun punch(type: PunchType, location: LocationProvider) {
        val q = queue ?: return
        val s = _state.value
        if (s.busy || type !in s.next) return
        // El canal APP está apagado: ni se pide ubicación ni se encola nada.
        if (!s.canPunch) {
            _state.update { it.copy(error = "La checada desde la app no está habilitada para tu empresa.") }
            return
        }
        if (s.agreementPending) {
            _state.update { it.copy(error = "Antes de checar, acepta el acuerdo de método de registro.") }
            return
        }
        _state.update { it.copy(busy = true, notice = null, error = null) }
        viewModelScope.launch {
            try {
                var locationNote: String? = null
                val fix = if (s.geoEnabled && s.shareLocation) {
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
