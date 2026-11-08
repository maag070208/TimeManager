package com.axzydev.checklab.settings

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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.approvals.ListFrame
import com.axzydev.checklab.approvals.ListViewModel
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.network.apiCall
import com.axzydev.checklab.core.time.dateTimeInZone
import com.axzydev.checklab.core.time.formatMinutes
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.DateField
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.people.Page
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

// ── Configuración del sistema (/nom/config) ───────────────────────────────

@Serializable
data class AttendanceDefaults(val entryToleranceMin: Int = 0, val exitToleranceMin: Int = 0, val mealBreakMin: Int = 0, val minOvertimeMin: Int = 0)

@Serializable
data class NomConfig(
    val workdayLimitMinutes: Int = 720,
    val weekStartDay: Int = 1,
    val attendanceDefaults: AttendanceDefaults = AttendanceDefaults(),
    val weeklyLimitMinutes: Int = 2880,
    val retentionMonths: Int = 60,
    val remotePunchEnabled: Boolean = false,
    val remoteCountsForWorkday: Boolean = false,
    val blockRemoteWithoutAgreement: Boolean = false,
    val requireUnionForCollective: Boolean = false,
)

@Serializable
data class DistributionAgreement(
    val id: String,
    val kind: String = "INDIVIDUAL",
    val party: String = "WORKER",
    val effectiveFrom: String,
    val effectiveTo: String? = null,
    val evidenceText: String = "",
    val acceptedAt: String? = null,
    val user: AgreementUser? = null,
)

@Serializable
data class AgreementUser(val name: String, val employeeNumber: String? = null)

@Serializable
data class TeleworkRegistration(
    val id: String,
    val userName: String,
    val employeeNumber: String? = null,
    val mode: String,
    val status: String,
    val homeAddress: String? = null,
    val startedAt: String? = null,
    val consentAcceptedAt: String? = null,
    val nextPeriodicDueAt: String? = null,
)

@Serializable
data class RoleInfo(val key: String, val name: String, val description: String? = null, val module: String? = null, val active: Boolean = true, val userCount: Int = 0)

@Serializable
data class AuditEntry(
    val id: String,
    val action: String,
    val module: String? = null,
    val userName: String? = null,
    val ipAddress: String? = null,
    val createdAt: String,
    val newState: JsonElement? = null,
)

class SettingsApi(private val client: HttpClient) {
    suspend fun config(): NomConfig = apiCall { client.get("nom/config") }
    suspend fun saveConfig(body: Map<String, JsonPrimitive>): JsonObject = apiCall { client.put("nom/config") { setBody(JsonObject(body)) } }
    suspend fun agreements(): List<DistributionAgreement> = apiCall { client.get("nom/distribution-agreements") }
    suspend fun createAgreement(input: AgreementInput): JsonObject = apiCall { client.post("nom/distribution-agreements") { setBody(input) } }
    suspend fun telework(): List<TeleworkRegistration> = apiCall { client.get("nom/telework/registrations") }
    suspend fun roles(): List<RoleInfo> = apiCall { client.get("permissions/roles") }
    suspend fun audit(page: Int): Page<AuditEntry> = apiCall {
        client.get("audit") {
            parameter("page", page)
            parameter("limit", 30)
        }
    }
}

private val WEEK_DAYS = listOf("Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado")

/**
 * Cuerpo de `PUT /nom/config`. Las claves son las de `NomSettingsUpdateDto` (zod `.strict()`):
 * una clave de más hace que el API rechace todo el guardado. Un número vacío cuenta como 0.
 */
internal fun configUpdate(
    entryTolerance: String,
    exitTolerance: String,
    mealBreak: String,
    minOvertime: String,
    remotePunch: Boolean,
    remoteCounts: Boolean,
    blockWithoutAgreement: Boolean,
    unionForCollective: Boolean,
): Map<String, JsonPrimitive> = mapOf(
    "defaultEntryToleranceMin" to JsonPrimitive(entryTolerance.toIntOrNull() ?: 0),
    "defaultExitToleranceMin" to JsonPrimitive(exitTolerance.toIntOrNull() ?: 0),
    "defaultMealBreakMin" to JsonPrimitive(mealBreak.toIntOrNull() ?: 0),
    "defaultMinOvertimeMin" to JsonPrimitive(minOvertime.toIntOrNull() ?: 0),
    "remotePunchEnabled" to JsonPrimitive(remotePunch),
    "remoteCountsForWorkday" to JsonPrimitive(remoteCounts),
    "blockRemoteWithoutAgreement" to JsonPrimitive(blockWithoutAgreement),
    "requireUnionForCollective" to JsonPrimitive(unionForCollective),
)

class ConfigViewModel(private val api: SettingsApi) : ListViewModel<NomConfig>() {
    override suspend fun fetch() = api.config()
    fun save(body: Map<String, JsonPrimitive>) = act("Configuración guardada.") { api.saveConfig(body) }
}

@Composable
private fun Toggle(label: String, detail: String, value: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        androidx.compose.foundation.layout.Column(Modifier.weight(1f)) {
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(detail, color = Brand.Muted, fontSize = 12.sp)
        }
        Switch(value, onChange, enabled = enabled, colors = SwitchDefaults.colors(checkedTrackColor = Brand.MintInk))
    }
}

@Composable
fun ColumnScope.ConfigContent(me: Me, vm: ConfigViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    val canEdit = me.can("time_clock.write")
    ListFrame(state) { cfg ->
        var entry by remember(cfg) { mutableStateOf("${cfg.attendanceDefaults.entryToleranceMin}") }
        var exit by remember(cfg) { mutableStateOf("${cfg.attendanceDefaults.exitToleranceMin}") }
        var meal by remember(cfg) { mutableStateOf("${cfg.attendanceDefaults.mealBreakMin}") }
        var minOt by remember(cfg) { mutableStateOf("${cfg.attendanceDefaults.minOvertimeMin}") }
        var remote by remember(cfg) { mutableStateOf(cfg.remotePunchEnabled) }
        var remoteCounts by remember(cfg) { mutableStateOf(cfg.remoteCountsForWorkday) }
        var block by remember(cfg) { mutableStateOf(cfg.blockRemoteWithoutAgreement) }
        var union by remember(cfg) { mutableStateOf(cfg.requireUnionForCollective) }

        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Jornada")
            InfoRow("La semana empieza", WEEK_DAYS.getOrElse(cfg.weekStartDay) { "—" })
            InfoRow("Jornada máxima diaria", formatMinutes(cfg.workdayLimitMinutes))
            InfoRow("Jornada máxima semanal", formatMinutes(cfg.weeklyLimitMinutes))
            InfoRow("Conservar registros", "${cfg.retentionMonths} meses")
        }
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Tolerancias por defecto (minutos)")
            Field(entry, { entry = it.filter(Char::isDigit) }, "Tolerancia de entrada", keyboardType = KeyboardType.Number)
            Field(exit, { exit = it.filter(Char::isDigit) }, "Tolerancia de salida", keyboardType = KeyboardType.Number)
            Field(meal, { meal = it.filter(Char::isDigit) }, "Comida", keyboardType = KeyboardType.Number)
            Field(minOt, { minOt = it.filter(Char::isDigit) }, "Mínimo para contar tiempo extra", keyboardType = KeyboardType.Number)
        }
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Checada desde la app")
            Toggle("Permitir checar desde la app", "Para teletrabajo y personal en ruta.", remote, canEdit) { remote = it }
            Toggle("Cuenta para la jornada", "Las checadas de la app suman horas como las del reloj.", remoteCounts, canEdit) { remoteCounts = it }
            Toggle("Exigir convenio de teletrabajo", "Sin convenio firmado no se puede checar a distancia.", block, canEdit) { block = it }
            Toggle("Convenios colectivos con sindicato", "Los convenios colectivos los firma el sindicato.", union, canEdit) { union = it }
        }
        if (canEdit) {
            PrimaryButton("Guardar cambios", {
                vm.save(configUpdate(entry, exit, meal, minOt, remote, remoteCounts, block, union))
            }, busy = state.busy)
        }
    }
}

// ── Convenios de distribución de jornada ──────────────────────────────────

@Serializable
data class AgreementInput(
    val userId: String? = null,
    val scheduleId: String? = null,
    val kind: String,
    val party: String,
    val effectiveFrom: String,
    val effectiveTo: String? = null,
    val evidenceText: String,
)

/** Validación local con las mismas reglas que `DistributionAgreementService.create`. */
fun agreementProblem(input: AgreementInput): String? = when {
    input.userId == null && input.scheduleId == null ->
        if (input.kind == "COLECTIVO") "Elige el horario del convenio." else "Elige a la persona del convenio."
    input.effectiveFrom.isBlank() -> "Elige desde cuándo aplica."
    input.effectiveTo != null && input.effectiveTo < input.effectiveFrom -> "La fecha final no puede ser antes de la inicial."
    input.evidenceText.trim().length < 20 -> "Describe el convenio con al menos 20 caracteres."
    else -> null
}

class AgreementsViewModel(
    private val api: SettingsApi,
    private val people: com.axzydev.checklab.people.PeopleApi,
    private val schedules: com.axzydev.checklab.schedules.SchedulesApi,
) : ListViewModel<List<DistributionAgreement>>() {
    private val _matches = kotlinx.coroutines.flow.MutableStateFlow<List<com.axzydev.checklab.people.Person>>(emptyList())
    val matches: kotlinx.coroutines.flow.StateFlow<List<com.axzydev.checklab.people.Person>> = _matches
    private val _scheduleOptions = kotlinx.coroutines.flow.MutableStateFlow<List<com.axzydev.checklab.schedules.Schedule>>(emptyList())
    val scheduleOptions: kotlinx.coroutines.flow.StateFlow<List<com.axzydev.checklab.schedules.Schedule>> = _scheduleOptions

    override suspend fun fetch() = api.agreements()

    fun search(q: String) {
        if (q.trim().length < 2) {
            _matches.value = emptyList()
            return
        }
        viewModelScope.launch { _matches.value = runCatching { people.people(q, active = true).data.take(6) }.getOrDefault(emptyList()) }
    }

    fun loadSchedules() {
        if (_scheduleOptions.value.isNotEmpty()) return
        viewModelScope.launch { _scheduleOptions.value = runCatching { schedules.list() }.getOrDefault(emptyList()) }
    }

    fun create(input: AgreementInput, onDone: () -> Unit) {
        val problem = agreementProblem(input)
        if (problem != null) {
            _state.update { it.copy(error = problem, notice = null) }
            return
        }
        act("Convenio registrado; queda pendiente de firma.") {
            api.createAgreement(input)
            onDone()
        }
    }
}

@Composable
fun ColumnScope.AgreementsContent(me: Me, vm: AgreementsViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var open by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.load() }
    if (creating) {
        AgreementForm(vm, state.busy, onClose = { creating = false })
        return
    }
    if (me.can("time_clock.write")) PrimaryButton("Registrar convenio", { creating = true })
    ListFrame(state) { list ->
        if (list.isEmpty()) BentoCard(Modifier.fillMaxWidth()) { Text("Aún no hay convenios registrados.", color = Brand.Muted) }
        list.forEach { a ->
            BentoCard(Modifier.fillMaxWidth()) {
                ListRow(
                    a.user?.name ?: if (a.kind == "COLECTIVO") "Convenio colectivo" else "Convenio",
                    "Vigente desde ${a.effectiveFrom.take(10)}" + (a.effectiveTo?.let { " hasta ${it.take(10)}" } ?: ""),
                    status = if (a.acceptedAt != null) "Firmado" else "Sin firmar",
                    statusColor = if (a.acceptedAt != null) Brand.MintInk else Brand.AmberInk,
                    statusTint = if (a.acceptedAt != null) Brand.MintSoft else Brand.AmberSoft,
                    onClick = { open = if (open == a.id) null else a.id },
                )
                if (open == a.id) {
                    InfoRow("Tipo", if (a.kind == "COLECTIVO") "Colectivo" else "Individual")
                    InfoRow("Firma", if (a.party == "UNION") "Sindicato" else "Persona trabajadora")
                    a.acceptedAt?.let { InfoRow("Firmado el", it.take(10)) }
                    Text(a.evidenceText, fontSize = 13.sp, color = Brand.Ink)
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.AgreementForm(vm: AgreementsViewModel, busy: Boolean, onClose: () -> Unit) {
    val state by vm.state.collectAsState()
    val matches by vm.matches.collectAsState()
    val scheduleOptions by vm.scheduleOptions.collectAsState()
    var kind by rememberSaveable { mutableStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    var personId by rememberSaveable { mutableStateOf<String?>(null) }
    var personName by rememberSaveable { mutableStateOf("") }
    var scheduleId by rememberSaveable { mutableStateOf<String?>(null) }
    var from by rememberSaveable { mutableStateOf("") }
    var to by rememberSaveable { mutableStateOf("") }
    var text by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(kind) { if (kind == 1) vm.loadSchedules() }

    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Nuevo convenio de jornada")
        PillTabs(listOf("Individual", "Colectivo"), kind, { kind = it })
        if (kind == 0) {
            if (personId != null) {
                ListRow(personName, "Persona del convenio", status = "Cambiar", statusColor = Brand.MintInk, onClick = { personId = null })
            } else {
                Field(query, { query = it; vm.search(it) }, "Buscar persona")
                matches.forEach { p ->
                    ListRow(p.name, listOfNotNull(p.employeeNumber?.let { "#$it" }, p.department?.name).joinToString(" · "), onClick = {
                        personId = p.id
                        personName = p.name
                    })
                }
            }
        } else {
            Text("Lo firma la representación sindical y aplica a todo un horario.", color = Brand.Muted, fontSize = 12.sp)
            scheduleOptions.filter { it.active }.forEach { sch ->
                ListRow(
                    sch.name,
                    status = if (sch.id == scheduleId) "Elegido" else null,
                    statusColor = Brand.MintInk,
                    statusTint = Brand.MintSoft,
                    onClick = { scheduleId = sch.id },
                )
            }
        }
        DateField("Aplica desde", from, { from = it })
        DateField("Hasta (opcional)", to, { to = it })
        Field(text, { text = it }, "Texto del convenio (art. 59 LFT)", imeAction = androidx.compose.ui.text.input.ImeAction.Default)
        state.error?.let { com.axzydev.checklab.design.Notice(it) }
        com.axzydev.checklab.design.ButtonPair("Registrar", {
            vm.create(
                AgreementInput(
                    userId = personId.takeIf { kind == 0 },
                    scheduleId = scheduleId.takeIf { kind == 1 },
                    kind = if (kind == 0) "INDIVIDUAL" else "COLECTIVO",
                    party = if (kind == 0) "WORKER" else "UNION",
                    effectiveFrom = from,
                    effectiveTo = to.ifBlank { null },
                    evidenceText = text,
                ),
                onDone = onClose,
            )
        }, "Cancelar", onClose, busy = busy)
    }
}

// ── Teletrabajo (NOM-037) ─────────────────────────────────────────────────

class TeleworkAdminViewModel(private val api: SettingsApi) : ListViewModel<List<TeleworkRegistration>>() {
    override suspend fun fetch() = api.telework()
}

private fun teleworkMode(m: String) = when (m) {
    "REMOTO" -> "Remoto"
    "HIBRIDO" -> "Híbrido"
    else -> m.lowercase().replaceFirstChar { it.uppercase() }
}

@Composable
fun ColumnScope.TeleworkAdminContent(vm: TeleworkAdminViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    PillTabs(listOf("Activos", "Terminados"), tab, { tab = it })
    ListFrame(state) { list ->
        val shown = list.filter { (it.status == "ACTIVE") == (tab == 0) }
        if (shown.isEmpty()) BentoCard(Modifier.fillMaxWidth()) { Text("Nadie en esta lista.", color = Brand.Muted) }
        shown.forEach { r ->
            BentoCard(Modifier.fillMaxWidth()) {
                ListRow(
                    r.userName,
                    listOfNotNull(r.employeeNumber?.let { "#$it" }, teleworkMode(r.mode)).joinToString(" · "),
                    status = if (r.consentAcceptedAt != null) "Con consentimiento" else "Sin consentimiento",
                    statusColor = if (r.consentAcceptedAt != null) Brand.MintInk else Brand.AmberInk,
                    statusTint = if (r.consentAcceptedAt != null) Brand.MintSoft else Brand.AmberSoft,
                )
                r.homeAddress?.let { InfoRow("Domicilio de trabajo", it) }
                r.startedAt?.let { InfoRow("Desde", it.take(10)) }
                r.nextPeriodicDueAt?.let { InfoRow("Próxima revisión del lugar", it.take(10)) }
            }
        }
    }
}

// ── Roles y permisos (consulta) ───────────────────────────────────────────

class RolesViewModel(private val api: SettingsApi) : ListViewModel<List<RoleInfo>>() {
    override suspend fun fetch() = api.roles()
}

@Composable
fun ColumnScope.RolesContent(vm: RolesViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    ListFrame(state) { roles ->
        roles.filter { it.module != "Plataforma" }.forEach { r ->
            BentoCard(Modifier.fillMaxWidth()) {
                ListRow(r.name.lowercase().replaceFirstChar { it.uppercase() }, r.description, status = "${r.userCount}", statusColor = Brand.Ink)
            }
        }
        Text("Los permisos de cada rol se editan desde la web de administración.", color = Brand.Muted, fontSize = 12.sp)
    }
}

// ── Auditoría ─────────────────────────────────────────────────────────────

private val AUDIT_LABELS = mapOf(
    "REMOTE_PUNCH_RECORDED" to "Checada desde la app",
    "NOM_SETTINGS_UPDATED" to "Configuración actualizada",
    "NOM_RETENTION_ARCHIVED" to "Archivo por retención",
    "USER_CREATED" to "Alta de persona",
    "USER_DEACTIVATED" to "Baja de persona",
    "USER_REACTIVATED" to "Reactivación de persona",
    "USER_PASSWORD_CHANGED" to "Cambio de contraseña",
    "WORK_RECORD_ACKNOWLEDGED" to "Constancia de jornada firmada",
    "SCHEDULE_ASSIGNED" to "Horario asignado",
    "SCHEDULE_UNASSIGNED" to "Horario retirado",
    "OVERTIME_APPROVAL_DECISION" to "Decisión de tiempo extra",
    "PAYROLL_WEEK_CLOSED" to "Semana de nómina cerrada",
    "PAYROLL_WEEK_REOPENED" to "Semana de nómina reabierta",
    "PAYROLL_DEPARTMENT_REVIEWED" to "Departamento revisado en pre-nómina",
    "TIME_CLOCK_LINKED" to "Persona vinculada al reloj",
    "WORKDAY_DISTRIBUTION_AGREEMENT_CREATED" to "Convenio de jornada registrado",
    "WORKDAY_DISTRIBUTION_AGREEMENT_ACCEPTED" to "Convenio de jornada firmado",
    "TELEWORK_CONSENT_ACCEPTED" to "Consentimiento de teletrabajo",
)

internal fun auditLabel(a: String) = AUDIT_LABELS[a] ?: a.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }

class AuditViewModel(private val api: SettingsApi) : ListViewModel<Page<AuditEntry>>() {
    var page = 1
        private set

    override suspend fun fetch() = api.audit(page)

    fun go(delta: Int) {
        page = (page + delta).coerceAtLeast(1)
        load()
    }
}

@Composable
fun ColumnScope.AuditContent(me: Me, vm: AuditViewModel = koinViewModel()) {
    val tz = me.tenant?.timezone ?: "America/Mexico_City"
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    ListFrame(state) { p ->
        BentoCard(Modifier.fillMaxWidth()) {
            p.data.forEach { e ->
                ListRow(
                    auditLabel(e.action),
                    listOfNotNull(e.userName, dateTimeInZone(e.createdAt, tz)).joinToString(" · "),
                )
            }
            if (p.data.isEmpty()) Text("Sin movimientos.", color = Brand.Muted)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (vm.page > 1) LinkButton("‹ Más recientes", { vm.go(-1) })
            Text("Página ${vm.page} de ${maxOf(1, (p.total + 29) / 30)}", Modifier.weight(1f), color = Brand.Muted, fontSize = 13.sp)
            if (vm.page * 30 < p.total) LinkButton("Anteriores ›", { vm.go(1) })
        }
    }
}
