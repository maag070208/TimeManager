package com.axzydev.checklab.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.network.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Estado de un bloque: oculto sin permiso, cargando, listo o con error propio. */
sealed interface Slot<out T> {
    data object Hidden : Slot<Nothing>
    data object Loading : Slot<Nothing>
    data class Ready<T>(val value: T) : Slot<T>
    data class Failed(val message: String) : Slot<Nothing>
}

data class HomeState(
    val attendance: Slot<AttendanceToday> = Slot.Hidden,
    val people: Slot<PeopleWidget> = Slot.Hidden,
    val records: Slot<HrRecordsWidget> = Slot.Hidden,
    val overtime: Slot<OvertimeWeek> = Slot.Hidden,
)

/**
 * Inicio del cliente: cada bloque se pide solo con su permiso y carga por su
 * cuenta (uno lento o caído no detiene a los demás), igual que la web.
 */
class HomeViewModel(private val api: DashboardApi) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    fun load(me: Me) {
        fetch(me.can("attendance.view"), { api.attendanceToday() }) { s, v -> s.copy(attendance = v) }
        fetch(me.can("hr.records"), { api.people() }) { s, v -> s.copy(people = v) }
        fetch(me.can("hr.records"), { api.hrRecords() }) { s, v -> s.copy(records = v) }
        fetch(me.can("overtime.view"), { api.overtimeWeek() }) { s, v -> s.copy(overtime = v) }
    }

    private fun <T> fetch(enabled: Boolean, call: suspend () -> T, set: (HomeState, Slot<T>) -> HomeState) {
        if (!enabled) {
            _state.update { set(it, Slot.Hidden) }
            return
        }
        _state.update { set(it, Slot.Loading) }
        viewModelScope.launch {
            val result = try {
                Slot.Ready(call())
            } catch (e: ApiException) {
                Slot.Failed(e.message)
            }
            _state.update { set(it, result) }
        }
    }
}
