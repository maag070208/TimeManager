package com.axzydev.checklab.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.core.network.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class LoginStep { Company, Credentials }

data class LoginState(
    val step: LoginStep = LoginStep.Company,
    val company: String = "",
    val companyName: String? = null,
    val companyColor: String? = null,
    val username: String = "",
    val password: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

/**
 * Login en dos pasos: el código de empresa (slug, se recuerda el último) y
 * luego usuario y contraseña. La app es del cliente: siempre hay empresa.
 */
class LoginViewModel(private val session: SessionRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginState(company = session.lastTenant.orEmpty()))
    val state: StateFlow<LoginState> = _state.asStateFlow()

    fun onCompany(value: String) = _state.update { it.copy(company = value.trim().lowercase(), error = null) }
    fun onUsername(value: String) = _state.update { it.copy(username = value, error = null) }
    fun onPassword(value: String) = _state.update { it.copy(password = value, error = null) }

    fun continueWithCompany() {
        val slug = _state.value.company
        if (slug.isEmpty()) {
            _state.update { it.copy(error = "Escribe el código de tu empresa.") }
            return
        }
        launchBusy {
            val branding = session.branding(slug)
            if (branding.name == null) {
                _state.update { it.copy(error = "No encontramos la empresa «$slug». Revisa el código con RH.") }
            } else {
                _state.update { it.copy(step = LoginStep.Credentials, companyName = branding.name, companyColor = branding.brandColor) }
            }
        }
    }

    fun back() = _state.update {
        it.copy(step = LoginStep.Company, companyName = null, companyColor = null, password = "", error = null)
    }

    fun submit() {
        val s = _state.value
        if (s.username.isBlank() || s.password.isEmpty()) {
            _state.update { it.copy(error = "Escribe tu usuario y tu contraseña.") }
            return
        }
        launchBusy {
            session.login(s.company, s.username, s.password)
            _state.update { it.copy(password = "") }
        }
    }

    private fun launchBusy(block: suspend () -> Unit) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                block()
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }
}

data class ChangePasswordState(
    val current: String = "",
    val next: String = "",
    val confirm: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

/** Contraseña provisional: no se entra a la app hasta cambiarla. */
class ChangePasswordViewModel(private val session: SessionRepository) : ViewModel() {
    private val _state = MutableStateFlow(ChangePasswordState())
    val state: StateFlow<ChangePasswordState> = _state.asStateFlow()

    fun onCurrent(value: String) = _state.update { it.copy(current = value, error = null) }
    fun onNext(value: String) = _state.update { it.copy(next = value, error = null) }
    fun onConfirm(value: String) = _state.update { it.copy(confirm = value, error = null) }

    fun submit() {
        val s = _state.value
        val problem = validateNewPassword(s.current, s.next, s.confirm)
        if (problem != null) {
            _state.update { it.copy(error = problem) }
            return
        }
        if (s.busy) return
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                session.changePassword(s.current, s.next)
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }

    fun signOut() = session.signOut()
}

/** Mismas reglas que el API (`newPassword` mínimo 6) más confirmación. */
fun validateNewPassword(current: String, next: String, confirm: String): String? = when {
    current.isEmpty() -> "Escribe tu contraseña actual."
    next.length < 6 -> "La nueva contraseña debe tener al menos 6 caracteres."
    next == current -> "La nueva contraseña debe ser distinta de la actual."
    next != confirm -> "Las contraseñas no coinciden."
    else -> null
}
