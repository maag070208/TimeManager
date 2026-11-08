package com.axzydev.checklab.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.remember
import io.github.alexzhirkevich.qrose.options.QrBrush
import io.github.alexzhirkevich.qrose.options.solid
import io.github.alexzhirkevich.qrose.rememberQrCodePainter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.navigation.Avatar
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

data class ProfileState(
    val current: String = "",
    val next: String = "",
    val confirm: String = "",
    val busy: Boolean = false,
    val notice: String? = null,
    val error: String? = null,
)

class ProfileViewModel(private val session: SessionRepository) : ViewModel() {
    private val _state = MutableStateFlow(ProfileState())
    val state: StateFlow<ProfileState> = _state.asStateFlow()

    fun onCurrent(v: String) = _state.update { it.copy(current = v, error = null, notice = null) }
    fun onNext(v: String) = _state.update { it.copy(next = v, error = null, notice = null) }
    fun onConfirm(v: String) = _state.update { it.copy(confirm = v, error = null, notice = null) }

    fun changePassword() {
        val s = _state.value
        validateNewPassword(s.current, s.next, s.confirm)?.let { problem ->
            _state.update { it.copy(error = problem) }
            return
        }
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                session.changePassword(s.current, s.next)
                _state.update { ProfileState(notice = "Tu contraseña se cambió.") }
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message) }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }
}

/**
 * Texto del QR de la credencial: el esquema v2 de la web (`widgets/employee-credential/model/buildQrPayload.ts`),
 * claves en el mismo orden y sin campos vacíos, para que los lectores existentes lo entiendan igual.
 */
fun credentialQrPayload(me: Me): String {
    fun clean(v: String?) = v?.trim()?.takeIf { it.isNotEmpty() }
    val fields = buildMap<String, JsonPrimitive> {
        put("v", JsonPrimitive(2))
        put("id", JsonPrimitive(me.id))
        clean(me.employeeNumber)?.let { put("no", JsonPrimitive(it)) }
        clean(me.name)?.let { put("name", JsonPrimitive(it)) }
        clean(me.jobTitle)?.let { put("pos", JsonPrimitive(it)) }
        clean(me.department?.name)?.let { put("dept", JsonPrimitive(it)) }
    }
    return JsonObject(fields).toString()
}

/** Nombres de rol del catálogo (`api/prisma/seed-data/roles.json`); los roles propios del cliente se muestran con su clave. */
private val ROLE_NAMES = mapOf(
    "CLIENT_ADMIN" to "Administración del cliente",
    "HUMAN_RESOURCES" to "Recursos Humanos",
    "CLIENT_STAFF" to "Personal",
)

/** Mi perfil: credencial digital, datos de la cuenta y cambio de contraseña. */
@Composable
fun ColumnScope.ProfileContent(me: Me, vm: ProfileViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()

    // Credencial: la que la persona muestra en la entrada, con su número de empleado.
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Brand.Navy, Color(0xFF121822))))
            .padding(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(me.name, 64, ring = Brand.Mint)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(me.name, color = Brand.Paper, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                me.jobTitle?.let { Text(it, color = Brand.Paper.copy(alpha = 0.75f), fontSize = 13.sp) }
                me.department?.let { Text(it.name, color = Brand.Paper.copy(alpha = 0.75f), fontSize = 13.sp) }
            }
        }
        Spacer(Modifier.height(18.dp))
        Text("NÚMERO DE EMPLEADO", color = Brand.Paper.copy(alpha = 0.6f), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Text(me.employeeNumber ?: "—", color = Brand.Mint, fontSize = 34.sp, fontWeight = FontWeight.Black)
        Text(me.tenant?.name.orEmpty(), color = Brand.Paper.copy(alpha = 0.75f), fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        val payload = remember(me) { credentialQrPayload(me) }
        Box(
            Modifier.align(Alignment.CenterHorizontally).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(14.dp),
        ) {
            Image(
                rememberQrCodePainter(payload) { colors { dark = QrBrush.solid(Brand.Navy) } },
                contentDescription = "Código QR de tu credencial",
                modifier = Modifier.size(180.dp),
            )
        }
        Text(
            "Muéstralo en la entrada o a quien te lo pida.",
            color = Brand.Paper.copy(alpha = 0.6f),
            fontSize = 12.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 8.dp),
        )
    }

    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Mi cuenta")
        InfoRow("Usuario", me.username)
        me.email?.let { InfoRow("Correo", it) }
        InfoRow("Rol", me.roles.ifEmpty { listOf(me.role) }.joinToString(", ") { ROLE_NAMES[it] ?: it })
    }

    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Cambiar contraseña")
        Field(state.current, vm::onCurrent, "Contraseña actual", password = true)
        Field(state.next, vm::onNext, "Nueva contraseña", password = true)
        Field(state.confirm, vm::onConfirm, "Confirma la nueva contraseña", password = true)
        state.notice?.let { Notice(it, error = false) }
        state.error?.let { Notice(it) }
        PrimaryButton("Guardar contraseña", vm::changePassword, busy = state.busy)
    }
}
