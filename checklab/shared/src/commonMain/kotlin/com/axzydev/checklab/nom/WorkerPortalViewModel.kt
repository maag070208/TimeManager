package com.axzydev.checklab.nom

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.home.Slot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import com.axzydev.checklab.core.time.mondayToSunday

data class Compliance(
    val agreement: RecordAgreement?,
    val proposal: RecordProposal,
    val acknowledgments: List<RecordAcknowledgment>,
    val overtime: List<OvertimeRequestRow>,
)

data class LeaveData(val balance: LeaveBalance, val types: List<LeaveType>, val requests: List<LeaveRequestRow>)

data class WorkerPortalState(
    val telework: Slot<MeTelework> = Slot.Loading,
    val compliance: Slot<Compliance> = Slot.Loading,
    val leave: Slot<LeaveData> = Slot.Loading,
    val busy: Boolean = false,
    val notice: String? = null,
    val error: String? = null,
)

/** Pestañas de Mi jornada fuera de la checada: teletrabajo, registro y horas extra, vacaciones. */
class WorkerPortalViewModel(private val api: WorkerApi, private val today: () -> LocalDate) : ViewModel() {
    private val _state = MutableStateFlow(WorkerPortalState())
    val state: StateFlow<WorkerPortalState> = _state.asStateFlow()

    fun load() {
        fetch({ api.telework() }) { s, v -> s.copy(telework = v) }
        fetch({ Compliance(api.recordAgreement(), api.recordProposal(), api.acknowledgments(), api.overtimeRequests()) }) { s, v -> s.copy(compliance = v) }
        fetch({
            val year = today().year
            LeaveData(api.leaveBalance(year), api.leaveTypes().filter { it.active }, api.myLeave())
        }) { s, v -> s.copy(leave = v) }
    }

    private fun <T> fetch(call: suspend () -> T, set: (WorkerPortalState, Slot<T>) -> WorkerPortalState) {
        viewModelScope.launch {
            val r = try {
                Slot.Ready(call())
            } catch (e: ApiException) {
                Slot.Failed(e.message)
            }
            _state.update { set(it, r) }
        }
    }

    /** Ejecuta una acción, avisa y recarga; un error del API se muestra tal cual. */
    private fun act(done: String, block: suspend () -> Unit) {
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

    fun dismiss() = _state.update { it.copy(notice = null, error = null) }

    fun acceptTelework(policy: TeleworkPolicy) = act("Aceptaste la política de teletrabajo.") { api.acceptTelework(policy) }

    fun submitChecklist(kind: String, answers: Map<String, Boolean>) =
        act("Checklist enviado a Recursos Humanos.") { api.submitChecklist(kind, answers.mapValues { if (it.value) "YES" else "NO" }) }

    fun acceptAgreement(proposal: RecordProposal) = act("Firmaste el acuerdo del método de registro.") { api.acceptRecordAgreement(proposal) }

    /** Constancia semanal: la persona confirma su semana o reporta una discrepancia. */
    fun acknowledgeWeek(start: String, end: String, accept: Boolean, note: String?) =
        act(if (accept) "Confirmaste tu semana." else "Enviaste tu discrepancia de la semana.") {
            api.acknowledge(AcknowledgeRequest(start, end, accept, note?.takeIf { it.isNotBlank() }))
        }

    fun decideOvertime(id: String, accept: Boolean) =
        act(if (accept) "Aceptaste el tiempo extra." else "Rechazaste el tiempo extra.") { api.decideOvertime(id, accept) }

    fun requestLeave(typeId: String, start: String, end: String, reason: String) =
        act("Solicitud enviada; te avisamos cuando RH la decida.") { api.requestLeave(CreateLeave(typeId, start, end, reason.trim().takeIf { it.isNotEmpty() })) }

    fun cancelLeave(id: String) = act("Solicitud cancelada.") { api.cancelLeave(id) }

    /** Semana en curso de lunes a domingo en la zona de la empresa, la misma que propone confirmar la web. */
    fun currentWeek(): Pair<String, String> = mondayToSunday(today())
}
