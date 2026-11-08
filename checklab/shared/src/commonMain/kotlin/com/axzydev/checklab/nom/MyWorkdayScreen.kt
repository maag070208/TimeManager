package com.axzydev.checklab.nom

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.core.location.rememberLocationProvider
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.CardSkeleton
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Field
import com.axzydev.checklab.design.Icon
import com.axzydev.checklab.design.Lucide
import com.axzydev.checklab.design.LucideIcon
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.Pill
import kotlinx.coroutines.delay
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock
import org.koin.compose.viewmodel.koinViewModel

private data class Step(val type: PunchType, val icon: LucideIcon, val color: Color, val tint: Color)

private val STEPS = listOf(
    Step(PunchType.ENTRY, Lucide.LogIn, Brand.MintInk, Brand.MintSoft),
    Step(PunchType.LUNCH_START, Lucide.Utensils, Brand.AmberInk, Brand.AmberSoft),
    Step(PunchType.LUNCH_END, Lucide.Coffee, Color(0xFF2F6FDB), Color(0x1F2F6FDB)),
    Step(PunchType.EXIT, Lucide.LogOut, Brand.Muted, Brand.Paper),
)

private fun iconOf(type: PunchType) = STEPS.first { it.type == type }.icon

/** Hora local `HH:mm`, viva: se actualiza cada 15 s mientras la pantalla está abierta. */
@Composable
private fun liveClock(timezone: String): String {
    val zone = remember(timezone) { runCatching { TimeZone.of(timezone) }.getOrDefault(TimeZone.currentSystemDefault()) }
    val now by produceState(Clock.System.now()) {
        while (true) {
            value = Clock.System.now()
            delay(15_000)
        }
    }
    val t = now.toLocalDateTime(zone)
    return "${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}"
}

/**
 * La checada: las cuatro marcas del día, el botón del siguiente paso y las
 * opciones (modalidad, nota, ubicación del momento). Se usa en Mi jornada y
 * arriba del inicio, para que checar sea lo primero que ve la persona.
 */
@Composable
fun ColumnScope.CheckPanel(me: Me, viewModel: MyWorkdayViewModel, compact: Boolean = false) {
    val state by viewModel.state.collectAsState()
    val location = rememberLocationProvider()
    val clock = liveClock(me.tenant?.timezone ?: "America/Mexico_City")

    if (state.loading) {
        CardSkeleton(Modifier.fillMaxWidth())
        return
    }

    val last = state.todayTypes.lastOrNull()
    val status = when (last) {
        null -> "Sin checar" to Brand.Muted
        PunchType.ENTRY, PunchType.LUNCH_END -> "En jornada" to Brand.MintInk
        PunchType.LUNCH_START -> "En comida" to Brand.AmberInk
        PunchType.EXIT -> "Jornada terminada" to Brand.Muted
    }

    BentoCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Eyebrow("Mi checada") }
            Pill(status.first, status.second, if (status.second == Brand.Muted) Brand.Paper else status.second.copy(alpha = 0.12f))
        }

        // Las cuatro marcas del día, como las tarjetas de Mi jornada en la web.
        STEPS.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { step ->
                    val done = state.timeOf(step.type)
                    val queued = state.pending.any { it.type == step.type } && done == null
                    Column(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (done != null || queued) step.tint else Brand.Paper)
                            .padding(12.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(step.icon, step.color, size = 15.dp)
                            Spacer(Modifier.width(6.dp))
                            Text(step.type.label.uppercase(), color = Brand.Muted, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            done?.let { viewModel.timeOf(it.occurredAt) } ?: if (queued) "Sin red" else "—",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                            color = if (done != null) Brand.Ink else Brand.Muted,
                        )
                        Text(
                            when {
                                done != null -> "Registrada"
                                queued -> "Se enviará sola"
                                else -> "Pendiente"
                            },
                            color = Brand.Muted,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }

        val primary = state.next.firstOrNull()
        if (primary == null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brand.Paper)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Lucide.CalendarCheck, Brand.MintInk, size = 22.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Jornada completa", color = Brand.Ink, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                    Text("Ya registraste tus checadas de hoy. Mañana podrás volver a checar.", color = Brand.Muted, fontSize = 13.sp)
                }
            }
        } else Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 72.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0xFFEAF6EF))
                .border(1.dp, Color(0xFFD1FAE5), RoundedCornerShape(18.dp))
                .clickable(enabled = !state.busy, role = Role.Button) { viewModel.punch(primary, location) }
                .semantics { contentDescription = "${primary.action} a las $clock" }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(46.dp).clip(CircleShape).background(Color(0xFFD1FAE5)), contentAlignment = Alignment.Center) {
                if (state.busy) {
                    CircularProgressIndicator(Modifier.size(20.dp), color = Brand.MintInk, strokeWidth = 2.dp)
                } else {
                    Icon(iconOf(primary), Brand.MintInk, size = 22.dp)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f).padding(end = 8.dp)) {
                Text("SIGUIENTE PASO", color = Brand.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Text(if (state.busy) "Registrando…" else primary.action, color = Brand.Ink, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
            }
            Text(clock, color = Brand.Ink, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }

        state.next.drop(1).forEach { other ->
            Text(
                "o ${other.action.replaceFirstChar { it.lowercase() }} sin salir a comer",
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(enabled = !state.busy, role = Role.Button) { viewModel.punch(other, location) }
                    .padding(vertical = 10.dp),
                color = Brand.MintInk,
                fontWeight = FontWeight.SemiBold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }

        state.notice?.let { Notice(it, error = false) }
        state.error?.let { Notice(it) }
        if (state.pending.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brand.AmberSoft).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Lucide.CloudOff, Brand.AmberInk, size = 16.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    "${state.pending.size} checada${if (state.pending.size > 1) "s" else ""} sin enviar. Se mandan solas al volver la conexión.",
                    color = Brand.AmberInk,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (!compact) CheckOptions(state, viewModel)
    }
}

@Composable
private fun CheckOptions(state: MyWorkdayState, viewModel: MyWorkdayViewModel) {
    Spacer(Modifier.height(2.dp))
    Eyebrow("Opciones de marcaje", color = Brand.Muted)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        WorkMode.entries.forEach { mode ->
            val selected = mode == state.workMode
            Text(
                mode.label,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (selected) Brand.Navy else Brand.Paper)
                    .clickable(role = Role.RadioButton) { viewModel.onWorkMode(mode) }
                    .padding(vertical = 9.dp),
                color = if (selected) Brand.Paper else Brand.Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 1,
            )
        }
    }
    Field(state.note, viewModel::onNote, "Nota (opcional)")
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Lucide.MapPin, Brand.Muted, size = 16.dp)
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text("Compartir ubicación en este marcaje", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Solo se guarda en la checada; no hay rastreo continuo.", color = Brand.Muted, fontSize = 12.sp)
        }
        Switch(
            checked = state.shareLocation,
            onCheckedChange = viewModel::onShareLocation,
            colors = SwitchDefaults.colors(checkedTrackColor = Brand.MintInk),
        )
    }
}

/** Mi jornada completa: la checada, la ubicación de la última checada y los marcajes de 14 días. */
@Composable
fun ColumnScope.MyWorkdayContent(me: Me, viewModel: MyWorkdayViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(me.id) { viewModel.start(me) }
    CheckPanel(me, viewModel)
    if (state.loading) return

    state.lastLocated?.let { punch -> LastLocationCard(punch, viewModel) }
    History(state, viewModel)
}

@Composable
private fun LastLocationCard(punch: MyPunch, viewModel: MyWorkdayViewModel) {
    val uri = LocalUriHandler.current
    val lat = punch.latitude ?: return
    val lng = punch.longitude ?: return
    BentoCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.MapPin, Brand.Rose, size = 16.dp)
            Spacer(Modifier.width(8.dp))
            Text("Ubicación de tu última checada", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        }
        Text(
            "${punch.type?.label ?: "Registro"} · ${viewModel.dayLabel(viewModel.dayOf(punch.occurredAt))} a las ${viewModel.timeOf(punch.occurredAt)}",
            color = Brand.Muted,
            fontSize = 13.sp,
        )
        Text("${lat.toString().take(9)}, ${lng.toString().take(10)}", fontSize = 13.sp, color = Brand.Ink)
        Row(
            Modifier
                .clip(RoundedCornerShape(12.dp))
                .clickable(role = Role.Button) { uri.openUri("https://www.google.com/maps/search/?api=1&query=$lat,$lng") }
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.ExternalLink, Brand.MintInk, size = 14.dp)
            Spacer(Modifier.width(6.dp))
            Text("Ver en el mapa", color = Brand.MintInk, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun History(state: MyWorkdayState, viewModel: MyWorkdayViewModel) {
    var reporting by remember { mutableStateOf<MyPunch?>(null) }
    BentoCard(Modifier.fillMaxWidth()) {
        Eyebrow("Mis marcajes · 14 días")
        if (state.history.isEmpty()) {
            Text("Aún no tienes marcajes en estos días.", color = Brand.Muted)
        }
        state.history.groupBy { viewModel.dayOf(it.occurredAt) }.forEach { (day, rows) ->
            Text(viewModel.dayLabel(day), color = Brand.Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
            rows.forEach { punch ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Brand.Paper)
                        .clickable(role = Role.Button) { reporting = punch }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(viewModel.timeOf(punch.occurredAt), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.width(12.dp))
                    Text(punch.type?.label ?: "Registro", modifier = Modifier.weight(1f), fontSize = 14.sp)
                    if (punch.latitude != null) {
                        Icon(Lucide.MapPin, Brand.Muted, size = 14.dp, description = "Con ubicación")
                        Spacer(Modifier.width(6.dp))
                    }
                    Pill(sourceLabel(punch.source), if (punch.source == "REMOTE") Color(0xFF2F6FDB) else Brand.Muted, if (punch.source == "REMOTE") Color(0x1F2F6FDB) else Color.White)
                }
            }
        }
        Text("Toca un marcaje si no coincide con lo que pasó para reportarlo a RH.", color = Brand.Muted, fontSize = 12.sp)
    }

    reporting?.let { punch -> DiscrepancyDialog(punch, viewModel) { reporting = null } }
}

@Composable
private fun DiscrepancyDialog(punch: MyPunch, viewModel: MyWorkdayViewModel, onClose: () -> Unit) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Reportar discrepancia") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "${punch.type?.label ?: "Registro"} de ${viewModel.dayLabel(viewModel.dayOf(punch.occurredAt)).lowercase()} a las ${viewModel.timeOf(punch.occurredAt)} (${sourceLabel(punch.source)}).",
                    color = Brand.Muted,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Field(reason, { reason = it }, "¿Qué pasó?")
                Text("La checada original no cambia: RH revisa tu reporte y, si procede, registra un ajuste.", color = Brand.Muted, fontSize = 12.sp)
            }
        },
        confirmButton = {
            val ready = reason.trim().length >= 5
            TextButton(onClick = { viewModel.reportDiscrepancy(punch.id, reason, onClose) }, enabled = ready) {
                Text("Enviar a RH", color = if (ready) Brand.MintInk else Brand.LineStrong, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("Cancelar", color = Brand.Muted) } },
        containerColor = Color.White,
    )
}
