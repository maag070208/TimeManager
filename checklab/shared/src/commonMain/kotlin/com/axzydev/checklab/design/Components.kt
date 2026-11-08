package com.axzydev.checklab.design

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.style.TextOverflow
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Instant
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, busy: Boolean = false, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled && !busy,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(Radius.Control),
        colors = ButtonDefaults.buttonColors(containerColor = Brand.Navy, contentColor = Brand.Paper),
    ) {
        if (busy) {
            // Proceso de envío dentro del botón, no carga de pantalla (esa usa esqueletos).
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Brand.Paper)
            Spacer(Modifier.width(10.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(Radius.Control),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = Brand.Navy)
    }
}

@Composable
fun LinkButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    TextButton(onClick = onClick, modifier = modifier.heightIn(min = 48.dp)) {
        Text(text, color = Brand.MintInk, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    onDone: () -> Unit = {},
    enabled: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Radius.Control),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (password) KeyboardType.Password else keyboardType,
            imeAction = imeAction,
            autoCorrectEnabled = false,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone() }, onGo = { onDone() }),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Brand.MintInk,
            focusedLabelColor = Brand.MintInk,
            unfocusedBorderColor = Brand.LineStrong,
            unfocusedContainerColor = Brand.Surface,
            focusedContainerColor = Brand.Surface,
        ),
    )
}

/** Tarjeta bento: fondo blanco, borde tenue y radio de marca. */
@Composable
fun BentoCard(modifier: Modifier = Modifier, tint: Color = Brand.Surface, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(Radius.Card))
            .background(tint)
            .border(1.dp, Brand.Line, RoundedCornerShape(Radius.Card))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

@Composable
fun Eyebrow(text: String, color: Color = Brand.MintInk) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = color)
}

/** Indicador grande con etiqueta, como los KPI del inicio web. */
@Composable
fun Kpi(label: String, value: String, modifier: Modifier = Modifier, accent: Color = Brand.Ink, tint: Color = Brand.Paper) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(Radius.Control))
            .background(tint)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = Brand.Muted)
        Spacer(Modifier.height(4.dp))
        Text(value, fontSize = 26.sp, fontWeight = FontWeight.Black, color = accent)
    }
}

/** Esqueleto de carga (el único indicador de carga de pantalla, como en la web). */
@Composable
fun Skeleton(modifier: Modifier = Modifier, height: Int = 18) {
    Box(
        modifier
            .fillMaxWidth()
            .height(height.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Brand.Line),
    )
}

@Composable
fun CardSkeleton(modifier: Modifier = Modifier) {
    BentoCard(modifier) {
        Skeleton(Modifier.fillMaxWidth(0.35f), 12)
        Skeleton(Modifier.fillMaxWidth(0.6f), 26)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Skeleton(Modifier.weight(1f), 56)
            Skeleton(Modifier.weight(1f), 56)
        }
    }
}

/** Aviso en línea; se anuncia a lectores de pantalla. */
@Composable
fun Notice(text: String, modifier: Modifier = Modifier, error: Boolean = true) {
    Text(
        text,
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.Control))
            .background(if (error) Brand.RoseSoft else Brand.MintSoft)
            .padding(PaddingValues(horizontal = 14.dp, vertical = 12.dp))
            .semantics { liveRegion = LiveRegionMode.Polite },
        color = if (error) Brand.Rose else Brand.MintInk,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
fun Pill(text: String, color: Color, tint: Color, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier
            .clip(RoundedCornerShape(Radius.Pill))
            .background(tint)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        color = color,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
fun CenteredColumn(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, content = content)
}

/** Pestañas tipo píldora (como los tabs de Mi jornada en la web), con desplazamiento horizontal. */
@Composable
fun PillTabs(tabs: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tabs.forEachIndexed { i, label ->
            val on = i == selected
            Text(
                label,
                modifier = Modifier
                    .clip(RoundedCornerShape(Radius.Pill))
                    .background(if (on) Brand.MintSoft else Brand.Surface)
                    .border(1.dp, if (on) Brand.MintSoft else Brand.Line, RoundedCornerShape(Radius.Pill))
                    .clickable(role = Role.Tab) { onSelect(i) }
                    .semantics { this.selected = on }
                    .padding(horizontal = 14.dp, vertical = 9.dp),
                color = if (on) Brand.MintInk else Brand.Ink,
                fontWeight = if (on) FontWeight.Bold else FontWeight.Medium,
                fontSize = 14.sp,
            )
        }
    }
}

/** Fila de dato: etiqueta a la izquierda y valor a la derecha. */
@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(label, color = Brand.Muted, fontSize = 13.sp, modifier = Modifier.padding(end = 12.dp))
        Text(value, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}

/** Fila tocable de lista: título, detalle y una píldora de estado. */
@Composable
fun ListRow(
    title: String,
    detail: String? = null,
    status: String? = null,
    statusColor: Color = Brand.Muted,
    statusTint: Color = Brand.Paper,
    leading: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.Paper)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(10.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!detail.isNullOrBlank()) Text(detail, color = Brand.Muted, fontSize = 12.5.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
        if (status != null) {
            Spacer(Modifier.width(8.dp))
            Pill(status, statusColor, statusTint)
        }
    }
}

/** Par de botones: primario (navy) y secundario (contorno), del mismo ancho. */
@Composable
fun ButtonPair(primary: String, onPrimary: () -> Unit, secondary: String, onSecondary: () -> Unit, busy: Boolean = false) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SecondaryButton(secondary, onSecondary, Modifier.weight(1f))
        PrimaryButton(primary, onPrimary, Modifier.weight(1f), busy = busy)
    }
}

/** Campo de fecha `AAAA-MM-DD` que abre el calendario nativo de Material. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.Control))
            .border(1.dp, Brand.LineStrong, RoundedCornerShape(Radius.Control))
            .clickable(role = Role.Button) { open = true }
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text(label, color = Brand.Muted, fontSize = 12.sp)
        Text(value.ifEmpty { "Elegir fecha" }, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = if (value.isEmpty()) Brand.Muted else Brand.Ink)
    }
    if (open) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = runCatching { LocalDate.parse(value).atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds() }.getOrNull(),
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.fromEpochMilliseconds(it).toLocalDateTime(TimeZone.UTC).date.toString()) }
                    open = false
                }) { Text("Listo", color = Brand.MintInk, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancelar", color = Brand.Muted) } },
        ) {
            DatePicker(state = state)
        }
    }
}
