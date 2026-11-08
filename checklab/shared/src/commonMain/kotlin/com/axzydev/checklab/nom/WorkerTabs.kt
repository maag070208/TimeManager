package com.axzydev.checklab.nom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
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
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.time.formatMinutes
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.ButtonPair
import com.axzydev.checklab.design.CardSkeleton
import com.axzydev.checklab.design.DateField
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.InfoRow
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.ListRow
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.PillTabs
import com.axzydev.checklab.design.PrimaryButton
import com.axzydev.checklab.home.Slot
import org.koin.compose.viewmodel.koinViewModel

private val TABS = listOf("Mi checada", "Teletrabajo", "Registro y horas extra", "Vacaciones y permisos")

/** Mi jornada con las cuatro pestañas de la web. */
@Composable
fun ColumnScope.MyWorkdayTabs(me: Me, portal: WorkerPortalViewModel = koinViewModel()) {
    var tab by rememberSaveable { mutableStateOf(0) }
    val state by portal.state.collectAsState()
    LaunchedEffect(me.id) { portal.load() }

    PillTabs(TABS, tab, { tab = it; portal.dismiss() })
    if (tab != 0) {
        state.notice?.let { Notice(it, error = false) }
        state.error?.let { Notice(it) }
    }
    when (tab) {
        0 -> MyWorkdayContent(me)
        1 -> SlotOf(state.telework) { TeleworkTab(it, state.busy, portal) }
        2 -> SlotOf(state.compliance) { ComplianceTab(it, state.busy, portal) }
        else -> SlotOf(state.leave) { LeaveTab(it, state.busy, portal) }
    }
}

@Composable
private fun <T> SlotOf(slot: Slot<T>, content: @Composable (T) -> Unit) {
    when (slot) {
        Slot.Hidden -> Unit
        Slot.Loading -> CardSkeleton(Modifier.fillMaxWidth())
        is Slot.Failed -> Notice(slot.message)
        is Slot.Ready -> content(slot.value)
    }
}

private fun day(iso: String?) = iso?.take(10).orEmpty()

// ── Teletrabajo ───────────────────────────────────────────────────────────

@Composable
private fun TeleworkTab(t: MeTelework, busy: Boolean, vm: WorkerPortalViewModel) {
    val reg = t.registration
    if (reg == null) {
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Teletrabajo (NOM-037)")
            Text("No estás registrado en teletrabajo. Si trabajas desde casa, RH te da de alta y aquí aceptas la política.", color = Brand.Muted)
        }
        return
    }
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Mi registro")
        InfoRow("Modalidad", WorkMode.entries.firstOrNull { it.name == reg.mode }?.label ?: reg.mode)
        InfoRow("Estatus", if (reg.status == "ACTIVE") "Activo" else reg.status)
        reg.homeAddress?.let { InfoRow("Domicilio", it) }
        InfoRow("Desde", day(reg.startedAt))
        t.lastChecklist?.let { InfoRow("Último checklist", day(it.completedAt)) }
        t.nextPeriodicDueAt?.let { InfoRow("Próximo checklist", day(it)) }
    }
    if (t.pendingConsent || !t.consentCurrent) {
        BentoCard(Modifier.fillMaxWidth(), tint = Brand.AmberSoft) {
            Eyebrow("Política por aceptar", color = Brand.AmberInk)
            Text("La política de teletrabajo, la de desconexión y el aviso de privacidad cambiaron o no los has aceptado.", fontSize = 14.sp)
            PolicyText(t.policy)
            PrimaryButton("Acepto la política (v${t.policy.policyVersion})", { vm.acceptTelework(t.policy) }, busy = busy)
        }
    } else {
        BentoCard(Modifier.fillMaxWidth()) {
            Eyebrow("Política vigente")
            Text("Aceptaste la versión ${t.policy.policyVersion} el ${day(reg.consentAcceptedAt)}.", color = Brand.Muted, fontSize = 13.sp)
            PolicyText(t.policy)
        }
    }
    ChecklistCard(t, busy, vm)
}

@Composable
private fun PolicyText(policy: TeleworkPolicy) {
    var open by remember { mutableStateOf(false) }
    Text(
        if (open) "Ocultar textos" else "Leer la política, desconexión y privacidad",
        modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button) { open = !open }.padding(vertical = 6.dp),
        color = Brand.MintInk,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
    )
    if (open) {
        listOf("Política de teletrabajo" to policy.teleworkPolicy, "Desconexión digital" to policy.disconnectPolicy, "Aviso de privacidad" to policy.privacyNotice)
            .forEach { (title, body) ->
                if (!body.isNullOrBlank()) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(body, color = Brand.Ink, fontSize = 13.5.sp)
                }
            }
    }
}

@Composable
private fun ChecklistCard(t: MeTelework, busy: Boolean, vm: WorkerPortalViewModel) {
    val answers = remember { mutableStateMapOf<String, Boolean>() }
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Checklist del lugar de trabajo")
        Text("Responde cada punto. Si algo no se cumple, RH lo revisa antes de validar tu lugar.", color = Brand.Muted, fontSize = 13.sp)
        t.checklistTemplate.items.forEach { key ->
            Column(Modifier.fillMaxWidth()) {
                Text(CHECKLIST_LABELS[key] ?: key, fontSize = 14.sp)
                Spacer(Modifier.width(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                    listOf(true to "Sí", false to "No").forEach { (value, label) ->
                        val on = answers[key] == value
                        Text(
                            label,
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(if (on) (if (value) Brand.MintSoft else Brand.RoseSoft) else Brand.Paper)
                                .clickable(role = Role.RadioButton) { answers[key] = value }
                                .padding(horizontal = 18.dp, vertical = 7.dp),
                            color = if (on) (if (value) Brand.MintInk else Brand.Rose) else Brand.Ink,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
        val complete = t.checklistTemplate.items.all { it in answers }
        PrimaryButton(
            if (complete) "Enviar checklist" else "Responde los ${t.checklistTemplate.items.size} puntos",
            { vm.submitChecklist(if (t.lastChecklist == null) "INITIAL" else "PERIODIC", answers.toMap()) },
            enabled = complete,
            busy = busy,
        )
    }
}

// ── Registro y horas extra ────────────────────────────────────────────────

@Composable
private fun ComplianceTab(c: Compliance, busy: Boolean, vm: WorkerPortalViewModel) {
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Acuerdo del método de registro")
        val a = c.agreement
        if (a?.acceptedAt != null) {
            Text("Firmado el ${day(a.acceptedAt)}${if (a.employerAcceptedAt != null) " · empresa ${day(a.employerAcceptedAt)}" else " · falta la firma de la empresa"}", fontSize = 14.sp)
            InfoRow("Métodos", a.methods.joinToString(", ") { METHOD_LABELS[it] ?: it })
            a.roundingPolicy?.let { InfoRow("Redondeo", it) }
            a.correctionRules?.let { Text(it, color = Brand.Muted, fontSize = 13.sp) }
        } else {
            Text(c.proposal.text, fontSize = 14.sp)
            InfoRow("Métodos", c.proposal.methods.joinToString(", ") { METHOD_LABELS[it] ?: it })
            PrimaryButton("Firmar el acuerdo", { vm.acceptAgreement(c.proposal) }, busy = busy)
        }
    }

    WeekCard(c, busy, vm)

    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Solicitudes de tiempo extra")
        if (c.overtime.isEmpty()) Text("No tienes solicitudes de tiempo extra.", color = Brand.Muted)
        c.overtime.forEach { r ->
            ListRow(
                title = "${formatMinutes(r.plannedMin)} · ${r.days.joinToString(", ")}",
                detail = r.reason,
                status = LEAVE_STATUS[r.status] ?: when (r.status) { "ACCEPTED" -> "Aceptada"; else -> r.status },
                statusColor = if (r.status == "PENDING") Brand.AmberInk else Brand.Muted,
                statusTint = if (r.status == "PENDING") Brand.AmberSoft else Brand.Surface,
            )
            if (r.status == "PENDING") {
                ButtonPair("Acepto", { vm.decideOvertime(r.id, true) }, "No acepto", { vm.decideOvertime(r.id, false) }, busy)
            }
        }
    }
}

@Composable
private fun WeekCard(c: Compliance, busy: Boolean, vm: WorkerPortalViewModel) {
    val (start, end) = vm.currentWeek()
    var note by remember { mutableStateOf("") }
    val done = c.acknowledgments.firstOrNull { day(it.periodStart) == start }
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Constancia semanal")
        if (done != null) {
            Text("Semana del $start al $end: ${if (done.status == "ACCEPTED") "confirmada" else "con discrepancia"} el ${day(done.acceptedAt)}.", fontSize = 14.sp)
        } else {
            Text("Revisa tu semana del $start al $end y confírmala, o reporta qué no coincide.", fontSize = 14.sp)
            Field(note, { note = it }, "Nota (si algo no coincide)")
            ButtonPair("Confirmar mi semana", { vm.acknowledgeWeek(start, end, true, note) }, "Reportar", { vm.acknowledgeWeek(start, end, false, note) }, busy)
        }
        c.acknowledgments.take(4).forEach { a ->
            val t = a.summary.totals
            ListRow(
                title = "${day(a.periodStart)} al ${day(a.periodEnd)}",
                detail = "Ordinarias ${formatMinutes(t.ordinaryMin)} · dobles ${formatMinutes(t.otDoubleMin)} · triples ${formatMinutes(t.otTripleMin)}",
                status = if (a.status == "ACCEPTED") "Confirmada" else "Discrepancia",
                statusColor = if (a.status == "ACCEPTED") Brand.MintInk else Brand.AmberInk,
                statusTint = if (a.status == "ACCEPTED") Brand.MintSoft else Brand.AmberSoft,
            )
        }
    }
}

// ── Vacaciones y permisos ─────────────────────────────────────────────────

@Composable
private fun LeaveTab(l: LeaveData, busy: Boolean, vm: WorkerPortalViewModel) {
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Vacaciones ${l.balance.year}")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kpi("Disponibles", "${l.balance.availableDays}", Modifier.weight(1f), accent = Brand.MintInk, tint = Brand.MintSoft)
            Kpi("Usados", "${l.balance.usedDays}", Modifier.weight(1f))
            Kpi("En trámite", "${l.balance.pendingDays}", Modifier.weight(1f), accent = Brand.AmberInk)
        }
        Text("Te corresponden ${l.balance.entitlementDays} días este año.", color = Brand.Muted, fontSize = 13.sp)
    }

    var typeId by rememberSaveable { mutableStateOf(l.types.firstOrNull()?.id.orEmpty()) }
    var start by rememberSaveable { mutableStateOf("") }
    var end by rememberSaveable { mutableStateOf("") }
    var reason by rememberSaveable { mutableStateOf("") }
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Nueva solicitud")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.fillMaxWidth()) {
                l.types.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 6.dp)) {
                        row.forEach { type ->
                            val on = type.id == typeId
                            Text(
                                type.name,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(if (on) Brand.Navy else Brand.Paper)
                                    .clickable(role = Role.RadioButton) { typeId = type.id }
                                    .padding(vertical = 9.dp, horizontal = 8.dp),
                                color = if (on) Brand.Paper else Brand.Ink,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                maxLines = 1,
                            )
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DateField("Desde", start, { start = it; if (end.isEmpty() || end < it) end = it }, Modifier.weight(1f))
            DateField("Hasta", end, { end = it }, Modifier.weight(1f))
        }
        Field(reason, { reason = it }, "Motivo (opcional)")
        PrimaryButton(
            "Enviar solicitud",
            {
                vm.requestLeave(typeId, start, end, reason)
                reason = ""
            },
            enabled = typeId.isNotEmpty() && start.isNotEmpty() && end.isNotEmpty() && end >= start,
            busy = busy,
        )
    }

    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Mis solicitudes")
        if (l.requests.isEmpty()) Text("Aún no tienes solicitudes.", color = Brand.Muted)
        l.requests.forEach { r ->
            ListRow(
                title = "${r.type.name} · ${r.days} día${if (r.days == 1) "" else "s"}",
                detail = "${r.startDate.take(10)} al ${r.endDate.take(10)}${r.decisionNote?.let { " · $it" } ?: ""}",
                status = LEAVE_STATUS[r.status] ?: r.status,
                statusColor = when (r.status) { "APPROVED" -> Brand.MintInk; "PENDING" -> Brand.AmberInk; "REJECTED" -> Brand.Rose; else -> Brand.Muted },
                statusTint = when (r.status) { "APPROVED" -> Brand.MintSoft; "PENDING" -> Brand.AmberSoft; "REJECTED" -> Brand.RoseSoft; else -> Brand.Surface },
            )
            if (r.status == "PENDING") {
                Text(
                    "Cancelar esta solicitud",
                    modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button) { vm.cancelLeave(r.id) }.padding(vertical = 4.dp, horizontal = 4.dp),
                    color = Brand.Rose,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }
        }
    }
}
