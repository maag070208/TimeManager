package com.axzydev.checklab.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import com.axzydev.checklab.navigation.Avatar
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.auth.PermissionScope
import com.axzydev.checklab.core.time.formatMinutes
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.CardSkeleton
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Kpi
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.Pill
import org.koin.compose.viewmodel.koinViewModel

/** Bloques del inicio del cliente; el marco (barra y drawer) lo pone `AppShell`. */
@Composable
fun ColumnScope.HomeContent(me: Me, viewModel: HomeViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(me.id) { viewModel.load(me) }

    // Con alcance propio, el panel de checada de arriba ya cuenta su día.
    SlotView(state.attendance) { attendance ->
        if (attendance.scope != PermissionScope.OWN.name) AttendanceCard(attendance)
    }
    SlotView(state.overtime) { OvertimeCard(it) }
    SlotView(state.people) { PeopleCard(it) }
    SlotView(state.records) { RecordsCard(it) }
    if (listOf(state.attendance, state.overtime, state.people, state.records).all { it is Slot.Hidden }) {
        BentoCard(Modifier.fillMaxWidth()) {
            Text("Tu inicio todavía no tiene bloques para tu rol.", color = Brand.Muted)
        }
    }
    LinkButton("Actualizar", { viewModel.load(me) }, Modifier.align(Alignment.CenterHorizontally))
}

@Composable
private fun <T> SlotView(slot: Slot<T>, content: @Composable (T) -> Unit) {
    when (slot) {
        Slot.Hidden -> Unit
        Slot.Loading -> CardSkeleton(Modifier.fillMaxWidth())
        is Slot.Failed -> Notice(slot.message)
        is Slot.Ready -> content(slot.value)
    }
}

/**
 * Hoy, en tres lecturas que no se mezclan: cuántos de los programados llegaron
 * (a tiempo + con retardo), cómo llegaron, y cuántos siguen adentro ahorita
 * (quien ya terminó su turno llegó, pero ya no está en sitio).
 */
@Composable
private fun AttendanceCard(data: AttendanceToday) {
    val c = data.summary()
    BentoCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Eyebrow("Hoy · asistencia") }
            Row(
                Modifier.clip(RoundedCornerShape(999.dp)).background(Brand.MintSoft).padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(Brand.Mint))
                Spacer(Modifier.width(6.dp))
                Text("${c.onSite} en sitio ahora", color = Brand.MintInk, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text("${c.arrived}", style = MaterialTheme.typography.headlineLarge)
            Text(" de ${c.scheduled} llegaron", style = MaterialTheme.typography.titleMedium, color = Brand.Muted)
        }
        LinearProgressIndicator(
            progress = { c.progress },
            modifier = Modifier.fillMaxWidth().height(6.dp),
            color = Brand.Mint,
            trackColor = Brand.Line,
            drawStopIndicator = {},
        )
        if (c.finished > 0) {
            Text(
                "${c.finished} ya terminaron su turno · ${c.onSite} siguen en sitio",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Muted,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kpi("A tiempo", "${c.onTime}", Modifier.weight(1f), accent = Brand.MintInk)
            Kpi("Retardo", "${c.late}", Modifier.weight(1f), accent = Brand.AmberInk)
            Kpi("Sin llegar", "${c.missing}", Modifier.weight(1f), accent = Brand.Rose)
        }
        val late = data.rows.filter { it.status == "LATE" }.sortedByDescending { it.lateMin }.take(3)
        if (late.isNotEmpty()) {
            Spacer(Modifier.height(2.dp))
            Eyebrow("Retardos de hoy", color = Brand.Muted)
            late.forEach { row ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(row.name, 32)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(row.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        row.departmentName?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Brand.Muted) }
                    }
                    Pill("${row.lateMin} min", Brand.AmberInk, Brand.AmberSoft)
                }
            }
        }
    }
}

@Composable
private fun OvertimeCard(data: OvertimeWeek) {
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Tiempo extra de la semana")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kpi("Por aprobar", formatMinutes(data.pendingExtraMin), Modifier.weight(1f), accent = Brand.AmberInk, tint = Brand.AmberSoft)
            Kpi("Aprobado", formatMinutes(data.approvedExtraMin), Modifier.weight(1f), accent = Brand.MintInk, tint = Brand.MintSoft)
        }
        data.topPending.take(3).forEach { row ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(row.name, 28)
                Spacer(Modifier.width(10.dp))
                Text(row.name, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(formatMinutes(row.pendingExtraMin), color = Brand.Muted)
            }
        }
    }
}

@Composable
private fun PeopleCard(data: PeopleWidget) {
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Personal")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kpi("Activos", "${data.active}", Modifier.weight(1f))
            Kpi("Altas del mes", "${data.hiresThisMonth}", Modifier.weight(1f), accent = Brand.MintInk)
            Kpi("Bajas del mes", "${data.departuresThisMonth}", Modifier.weight(1f))
        }
    }
}

@Composable
private fun RecordsCard(data: HrRecordsWidget) {
    val s = data.summary
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Expedientes")
        Row(verticalAlignment = Alignment.Bottom) {
            Text("${s.complete}", style = MaterialTheme.typography.headlineLarge)
            Text(" / ${s.employees} completos", style = MaterialTheme.typography.titleMedium, color = Brand.Muted)
        }
        LinearProgressIndicator(
            progress = { if (s.employees == 0) 0f else s.complete.toFloat() / s.employees },
            modifier = Modifier.fillMaxWidth().height(6.dp),
            color = Brand.Mint,
            trackColor = Brand.Line,
            drawStopIndicator = {},
        )
        if (s.missingRequired > 0) {
            Pill("${s.missingRequired} con documentos obligatorios faltantes", Brand.Rose, Brand.RoseSoft)
        }
    }
}

