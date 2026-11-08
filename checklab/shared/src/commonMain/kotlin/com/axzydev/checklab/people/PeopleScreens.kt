package com.axzydev.checklab.people

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.approvals.ListFrame
import com.axzydev.checklab.approvals.ListViewModel
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.ButtonPair
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.navigation.Avatar
import org.koin.compose.viewmodel.koinViewModel

// ── Personal ──────────────────────────────────────────────────────────────

class PeopleViewModel(private val api: PeopleApi) : ListViewModel<Page<Person>>() {
    var query = ""
        private set
    var active: Boolean? = true
        private set

    override suspend fun fetch() = api.people(query, active)

    fun search(q: String) {
        query = q
        load()
    }

    fun filter(active: Boolean?) {
        this.active = active
        load()
    }

    fun create(p: CreatePerson, onDone: () -> Unit) = act("Alta registrada: ${p.name}.") {
        api.create(p)
        onDone()
    }
}

class EmployeeViewModel(private val api: PeopleApi) : ListViewModel<EmployeeOverview>() {
    private var id = ""
    override suspend fun fetch() = api.overview(id)

    fun open(id: String) {
        this.id = id
        load()
    }

    fun deactivate(reason: String) = act("Baja registrada.") { api.deactivate(id, reason) }
    fun reactivate() = act("Persona reactivada.") { api.reactivate(id) }
}

@Composable
fun ColumnScope.PeopleContent(me: Me, vm: PeopleViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var q by rememberSaveable { mutableStateOf("") }
    var tab by rememberSaveable { mutableStateOf(0) }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    var adding by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.load() }

    openId?.let { id ->
        EmployeeDetail(id, me, onBack = { openId = null; vm.load() })
        return
    }
    if (adding) {
        NewPerson(vm, state.busy) { adding = false }
        return
    }

    Field(q, { q = it; vm.search(it) }, "Buscar por nombre")
    PillTabs(listOf("Activos", "De baja", "Todos"), tab, { tab = it; vm.filter(listOf(true, false, null)[it]) })
    if (me.can("users.create")) LinkButton("+ Dar de alta a una persona", { adding = true })
    ListFrame(state) { page ->
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("${page.total} persona${if (page.total == 1) "" else "s"}")
            page.data.forEach { p ->
                ListRow(
                    title = p.name,
                    detail = listOfNotNull(p.employeeNumber?.let { "#$it" }, p.jobTitle, p.department?.name).joinToString(" · "),
                    status = if (p.active) null else "Baja",
                    statusColor = Brand.Rose,
                    statusTint = Brand.RoseSoft,
                    leading = { Avatar(p.name, 34) },
                    onClick = { openId = p.id },
                )
            }
            if (page.total > page.data.size) Text("Mostrando ${page.data.size} de ${page.total}. Afina la búsqueda para ver a alguien más.", color = Brand.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ColumnScope.EmployeeDetail(id: String, me: Me, onBack: () -> Unit, vm: EmployeeViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var reason by remember { mutableStateOf("") }
    LaunchedEffect(id) { vm.open(id) }
    LinkButton("‹ Volver al personal", onBack)
    ListFrame(state) { o ->
        val e = o.employee
        BentoCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Avatar(e.name, 56)
                Column {
                    Text(e.name, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    Text(listOfNotNull(e.employeeNumber?.let { "#$it" }, e.jobTitle, e.department).joinToString(" · "), color = Brand.Muted, fontSize = 13.sp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Documentos", "${o.summary.documents}", Modifier.weight(1f))
                Kpi("Faltan", "${o.summary.missingRequiredDocuments}", Modifier.weight(1f), accent = if (o.summary.missingRequiredDocuments > 0) Brand.Rose else Brand.MintInk)
                Kpi("Actas (año)", "${o.summary.disciplinaryReportsLastYear}", Modifier.weight(1f))
            }
            InfoRow("Horario", o.schedule?.name ?: "Sin horario")
            InfoRow("Checadas (30 días)", "${o.summary.punchesLast30Days}")
            InfoRow("Estatus", if (e.active) "Activo" else "De baja")
        }
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Documentos del expediente")
            if (o.documents.isEmpty()) Text("Sin documentos cargados.", color = Brand.Muted)
            o.documents.forEach { d -> ListRow(title = d.type ?: d.name, detail = "${d.name} · ${d.uploadedAt?.take(10).orEmpty()}") }
        }
        if (me.can("users.edit") || me.can("users.delete")) {
            BentoCard(Modifier.fillMaxWidth()) {
                if (e.active) {
                    Eyebrow("Dar de baja", color = Brand.Rose)
                    Text("La persona deja de poder entrar y sale de los relojes. Su historial se conserva.", color = Brand.Muted, fontSize = 13.sp)
                    Field(reason, { reason = it }, "Motivo de la baja")
                    PrimaryButton("Registrar baja", { vm.deactivate(reason) }, enabled = reason.trim().length >= 3, busy = state.busy)
                } else {
                    Eyebrow("Reactivar")
                    PrimaryButton("Reactivar a la persona", vm::reactivate, busy = state.busy)
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.NewPerson(vm: PeopleViewModel, busy: Boolean, onClose: () -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var number by rememberSaveable { mutableStateOf("") }
    var job by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    val state by vm.state.collectAsState()
    LinkButton("‹ Cancelar alta", onClose)
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Alta de personal")
        Field(name, { name = it }, "Nombre completo")
        Field(username, { username = it.trim().lowercase() }, "Usuario (mínimo 3)")
        Field(number, { number = it.trim() }, "Número de empleado")
        Field(job, { job = it }, "Puesto")
        Field(email, { email = it.trim() }, "Correo (opcional)")
        Field(password, { password = it }, "Contraseña provisional (mínimo 6)", password = true)
        Text("La persona tendrá que cambiar la contraseña al entrar. Departamento, horario y reloj se asignan después.", color = Brand.Muted, fontSize = 12.sp)
        state.error?.let { Notice(it) }
        PrimaryButton(
            "Dar de alta",
            {
                vm.create(
                    CreatePerson(
                        username = username,
                        password = password,
                        name = name.trim(),
                        email = email.ifBlank { null },
                        jobTitle = job.ifBlank { null },
                        employeeNumber = number.ifBlank { null },
                        role = "CLIENT_STAFF",
                    ),
                    onClose,
                )
            },
            enabled = name.isNotBlank() && username.length >= 3 && password.length >= 6,
            busy = busy,
        )
    }
}

// ── Expedientes ───────────────────────────────────────────────────────────

class RecordsViewModel(private val api: PeopleApi) : ListViewModel<RecordsWidget>() {
    override suspend fun fetch() = api.records()
}

@Composable
fun ColumnScope.RecordsContent(vm: RecordsViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(Unit) { vm.load() }
    ListFrame(state) { r ->
        val s = r.summary
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Expedientes")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kpi("Completos", "${s.complete}/${s.employees}", Modifier.weight(1f), accent = Brand.MintInk)
                Kpi("Faltan obligatorios", "${s.missingRequired}", Modifier.weight(1f), accent = Brand.Rose)
            }
        }
        PillTabs(listOf("Con faltantes", "Todos"), tab, { tab = it })
        BentoCard(Modifier.fillMaxWidth()) {
            val rows = if (tab == 0) r.rows.filter { it.missingRequired.isNotEmpty() || it.missingDocuments.isNotEmpty() } else r.rows
            if (rows.isEmpty()) Text("Todos los expedientes están completos.", color = Brand.Muted)
            rows.forEach { row ->
                val missing = row.missingRequired.map { it.name } + row.missingDocuments.map { it.name }
                ListRow(
                    title = row.name,
                    detail = listOfNotNull(row.departmentName, if (missing.isEmpty()) "Completo" else "Falta: ${missing.distinct().joinToString(", ")}").joinToString(" · "),
                    status = if (row.missingRequired.isNotEmpty()) "Obligatorio" else null,
                    statusColor = Brand.Rose,
                    statusTint = Brand.RoseSoft,
                    leading = { Avatar(row.name, 30) },
                )
            }
        }
    }
}

// ── Organización ──────────────────────────────────────────────────────────

class DepartmentsViewModel(private val api: PeopleApi) : ListViewModel<List<Department>>() {
    override suspend fun fetch() = api.departments()
}

@Composable
fun ColumnScope.DepartmentsContent(vm: DepartmentsViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    ListFrame(state) { list ->
        list.forEach { d ->
            BentoCard(Modifier.fillMaxWidth()) {
                Row {
                    Text(d.name, fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = Modifier.weight(1f))
                    Text("${d.count?.users ?: 0} personas", color = Brand.Muted, fontSize = 13.sp)
                }
                if (d.subareas.isEmpty()) Text("Sin subáreas", color = Brand.Muted, fontSize = 13.sp)
                d.subareas.forEach { s -> ListRow(title = s.name) }
            }
        }
    }
}

// ── Actas administrativas ─────────────────────────────────────────────────

class ActasViewModel(private val api: PeopleApi) : ListViewModel<Page<Acta>>() {
    private var q = ""
    override suspend fun fetch() = api.actas(q)

    fun search(text: String) {
        q = text
        load()
    }
}

@Composable
fun ColumnScope.ActasContent(vm: ActasViewModel = koinViewModel()) {
    val state by vm.state.collectAsState()
    var q by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(Unit) { vm.load() }
    Field(q, { q = it; vm.search(it) }, "Buscar por empleado, número o descripción")
    ListFrame(state) { page ->
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("${page.total} reporte${if (page.total == 1) "" else "s"}")
            page.data.forEach { a ->
                ListRow(
                    title = a.user?.name ?: "Persona",
                    detail = "${a.incidentDate} · ${a.description.orEmpty()}${a.sanction?.let { "\nSanción: $it" } ?: ""}",
                    status = ACTA_REASONS[a.reason] ?: a.reason,
                    statusColor = Brand.AmberInk,
                    statusTint = Brand.AmberSoft,
                    leading = { Avatar(a.user?.name ?: a.id, 30) },
                )
            }
        }
    }
}
