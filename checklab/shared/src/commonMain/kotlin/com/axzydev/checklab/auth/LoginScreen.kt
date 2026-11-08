package com.axzydev.checklab.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalDensity
import kotlinx.coroutines.delay
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.Icon
import com.axzydev.checklab.design.Lucide
import com.axzydev.checklab.design.LucideIcon
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.design.blobatar.BlobatarImage
import com.axzydev.checklab.design.blobatar.hexColor
import com.axzydev.checklab.resources.Res
import com.axzydev.checklab.resources.logo_dark_bg
import org.jetbrains.compose.resources.painterResource
import org.koin.compose.viewmodel.koinViewModel

/** Paleta del login web (`features/auth/login/ui/login.css`). */
private object LoginColors {
    val NavyDeep = Color(0xFF121822)
    val Heading = Brand.Navy
    val Muted = Color(0xFF5B6474)
    val BadgeBg = Color(0xFFEAF6EF)
    val FieldBg = Color(0xFFF1F4F9)
    val FieldFocus = Color(0xFF8C95A3)
    val Label = Color(0xFF2B3442)
    val Placeholder = Color(0xFF8A94A6)
    val TenantChipBg = Color(0xFFECFDF5)
    val TenantChipText = Color(0xFF047857)
    val CardBorder = Color(0xFFE2E8F0)
    val CardBg = Color(0xFFF8FAFC)
    val OnBrand = Brand.Paper
    val OnBrandMuted = Brand.Paper.copy(alpha = 0.7f)
}

/** Mismas semillas que el panel de marca de la web, así salen las mismas caritas. */
private val TEAM_SEEDS = listOf("entrada", "comida", "turno-noche", "salida")

private val FEATURES = listOf(
    Lucide.Fingerprint to "Checadas y biometría",
    Lucide.CalendarClock to "Horarios y turnos",
    Lucide.Timer to "Horas extra",
    Lucide.FileChart to "Reportes de asistencia",
)

private fun initials(name: String) =
    name.split(Regex("\\s+")).filter { it.isNotEmpty() }.takeLast(2).joinToString("") { it.first().uppercase() }

private fun shortTenant(name: String) = name.replace(Regex("^Cliente\\s+(E2E\\s+)?", RegexOption.IGNORE_CASE), "")

/** Panel navy con halo ámbar, anillos, titular, equipo en blobatars y funciones. */
@Composable
private fun BrandHero(companyName: String?, accent: Color) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Brush.linearGradient(listOf(Brand.Navy, LoginColors.NavyDeep), start = Offset.Zero, end = Offset(600f, 1400f)))
            .drawBehind {
                drawRect(
                    Brush.radialGradient(
                        listOf(Brand.Amber.copy(alpha = 0.22f), Color.Transparent),
                        center = Offset(size.width * 1.08f, -size.height * 0.08f),
                        radius = size.width * 0.75f,
                    ),
                )
                val ring = Offset(size.width + 40.dp.toPx(), size.height + 40.dp.toPx())
                drawCircle(Brand.Paper.copy(alpha = 0.06f), radius = 208.dp.toPx(), center = ring, style = Stroke(2.dp.toPx()))
                drawCircle(Brand.Amber.copy(alpha = 0.18f), radius = 144.dp.toPx(), center = ring, style = Stroke(2.dp.toPx()))
            }
            .statusBarsPadding()
            .padding(start = 24.dp, end = 24.dp, top = 20.dp, bottom = 52.dp),
    ) {
        Column {
            if (companyName != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.White),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(initials(companyName), color = Brand.Navy, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(companyName, color = LoginColors.OnBrand, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("con CheckLab", color = LoginColors.OnBrandMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            } else {
                Image(painterResource(Res.drawable.logo_dark_bg), contentDescription = "Logotipo de CheckLab", modifier = Modifier.height(46.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "ASISTENCIA · RECURSOS HUMANOS",
                color = LoginColors.OnBrandMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.8.sp,
            )

            Spacer(Modifier.height(26.dp))
            Text(
                buildAnnotatedString {
                    append("Cada checada, ")
                    withStyle(SpanStyle(color = accent)) { append("en su lugar.") }
                },
                color = LoginColors.OnBrand,
                fontSize = 30.sp,
                lineHeight = 33.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Checadas, horarios y horas extra de todo tu equipo en un solo registro, listo para revisar.",
                color = LoginColors.OnBrandMuted,
                fontSize = 14.sp,
                lineHeight = 21.sp,
            )

            Spacer(Modifier.height(20.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Brand.Paper.copy(alpha = 0.06f))
                    .border(1.dp, Brand.Paper.copy(alpha = 0.09f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.width((34 + 26 * (TEAM_SEEDS.size - 1)).dp).height(34.dp)) {
                    TEAM_SEEDS.forEachIndexed { i, seed ->
                        Box(
                            Modifier
                                .offset(x = (26 * i).dp)
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Brand.Paper)
                                .border(3.dp, Brand.Navy, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            BlobatarImage(seed, size = 30.dp)
                        }
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Tu equipo en tiempo real", color = LoginColors.OnBrand, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("Entradas y salidas al momento", color = LoginColors.OnBrandMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }

            Spacer(Modifier.height(16.dp))
            FEATURES.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                    row.forEach { (icon, label) ->
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, Brand.Mint, size = 15.dp)
                            Spacer(Modifier.width(8.dp))
                            Text(label, color = LoginColors.OnBrand, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(Brand.Amber))
                Spacer(Modifier.width(8.dp))
                Text("Registro en tiempo real", color = LoginColors.OnBrandMuted, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

/** Hoja blanca que se monta sobre el panel de marca, como la tarjeta del login web. */
@Composable
fun LoginScaffold(companyName: String?, accent: Color = Brand.Mint, content: @Composable ColumnScope.() -> Unit) {
    val scroll = rememberScrollState()
    val keyboard = WindowInsets.ime.getBottom(LocalDensity.current)
    // Con el teclado abierto, el formulario sube al final para que el campo, el
    // aviso de error y el botón no queden debajo del teclado.
    LaunchedEffect(keyboard > 0) {
        if (keyboard > 0) {
            delay(80)
            scroll.animateScrollTo(scroll.maxValue)
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize().background(Color.White)) {
        val minSheet = maxHeight * 0.5f
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .imePadding(),
        ) {
            BrandHero(companyName, accent)
            Column(
                Modifier
                    .offset(y = (-28).dp)
                    .fillMaxWidth()
                    .heightIn(min = minSheet)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .background(Color.White)
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = 420.dp).fillMaxWidth(), content = content)
            }
        }
    }
}

@Composable
private fun Badge(text: String) {
    Text(
        text.uppercase(),
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(LoginColors.BadgeBg).padding(horizontal = 12.dp, vertical = 5.dp),
        color = Brand.MintInk,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.5.sp,
    )
}

@Composable
private fun Heading(title: String, subtitle: String) {
    Spacer(Modifier.height(18.dp))
    Text(
        title,
        color = LoginColors.Heading,
        fontSize = 28.sp,
        lineHeight = 32.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.6).sp,
        modifier = Modifier.semantics { heading() },
    )
    Spacer(Modifier.height(8.dp))
    Text(subtitle, color = LoginColors.Muted, fontSize = 14.sp, lineHeight = 21.sp)
}

/** Campo píldora del kit web: etiqueta arriba, fondo gris claro, icono a la derecha. */
@Composable
private fun PillField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    icon: LucideIcon,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    onDone: () -> Unit = {},
    password: Boolean = false,
) {
    var focused by remember { mutableStateOf(false) }
    var visible by remember { mutableStateOf(false) }
    Text(label, color = LoginColors.Label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(8.dp))
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(LoginColors.FieldBg)
            .border(2.dp, if (focused) LoginColors.FieldFocus else Color.Transparent, RoundedCornerShape(999.dp))
            .padding(start = 18.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f).padding(vertical = 14.dp)) {
            if (value.isEmpty()) Text(placeholder, color = LoginColors.Placeholder, fontSize = 16.sp)
            BasicTextField(
                value = value,
                onValueChange = onChange,
                singleLine = true,
                textStyle = TextStyle(color = Brand.Ink, fontSize = 16.sp),
                cursorBrush = SolidColor(Brand.MintInk),
                visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(
                    keyboardType = if (password) KeyboardType.Password else keyboardType,
                    imeAction = imeAction,
                    autoCorrectEnabled = false,
                ),
                keyboardActions = KeyboardActions(
                    onDone = { onDone() },
                    onGo = { onDone() },
                    onSend = { onDone() },
                    onSearch = { onDone() },
                ),
                modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
            )
        }
        val trailing = if (password) (if (visible) Lucide.EyeOff else Lucide.Eye) else icon
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .then(
                    if (password) Modifier.clickable(role = Role.Button) { visible = !visible } else Modifier,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                trailing,
                LoginColors.Placeholder,
                size = 18.dp,
                description = if (password) (if (visible) "Ocultar contraseña" else "Mostrar contraseña") else null,
            )
        }
    }
    Spacer(Modifier.height(18.dp))
}

@Composable
private fun SubmitButton(text: String, icon: LucideIcon, busy: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 54.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (busy) Brand.Navy.copy(alpha = 0.85f) else Brand.Navy)
            .clickable(enabled = !busy, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(16.dp), color = Brand.Paper, strokeWidth = 2.dp)
        } else {
            Icon(icon, Brand.Paper, size = 18.dp)
        }
        Spacer(Modifier.width(10.dp))
        Text(text, color = Brand.Paper, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun TextLink(text: String, onClick: () -> Unit) {
    Text(
        text,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 14.dp),
        color = LoginColors.Muted,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
    )
}

@Composable
private fun Footer() {
    Spacer(Modifier.height(28.dp))
    Row(Modifier.fillMaxWidth()) {
        Text("CheckLab · Control de asistencia", color = LoginColors.Muted, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
        Text("v1.0", color = LoginColors.Muted, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun LoginScreen(notice: String?, viewModel: LoginViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val accent = state.companyColor?.let { runCatching { hexColor(it) }.getOrNull() } ?: Brand.Mint
    LoginScaffold(companyName = state.companyName, accent = accent) {
        Badge("Acceso seguro")
        when (state.step) {
            LoginStep.Company -> {
                Heading("Bienvenido de nuevo", "Inicia sesión para registrar y consultar la asistencia.")
                Spacer(Modifier.height(22.dp))
                if (notice != null) {
                    Notice(notice, error = false)
                    Spacer(Modifier.height(14.dp))
                }
                PillField(
                    label = "Código de tu empresa",
                    value = state.company,
                    onChange = viewModel::onCompany,
                    placeholder = "ej. acme",
                    icon = Lucide.Building,
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Done,
                    onDone = viewModel::continueWithCompany,
                )
                state.error?.let {
                    Notice(it)
                    Spacer(Modifier.height(14.dp))
                }
                SubmitButton("Continuar", Lucide.ArrowRight, state.busy, viewModel::continueWithCompany)
                Spacer(Modifier.height(14.dp))
                Text(
                    "¿No sabes tu código? Pídelo a Recursos Humanos de tu empresa.",
                    color = LoginColors.Muted,
                    fontSize = 13.sp,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }

            LoginStep.Credentials -> {
                Heading("Bienvenido de nuevo", "Inicia sesión para registrar y consultar la asistencia.")
                Spacer(Modifier.height(12.dp))
                Text(
                    "Acceso para ${state.companyName}",
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(LoginColors.TenantChipBg).padding(horizontal = 12.dp, vertical = 6.dp),
                    color = LoginColors.TenantChipText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(22.dp))
                PillField(
                    label = "Usuario o número de empleado",
                    value = state.username,
                    onChange = viewModel::onUsername,
                    placeholder = "admin",
                    icon = Lucide.User,
                    keyboardType = KeyboardType.Email,
                )
                PillField(
                    label = "Contraseña",
                    value = state.password,
                    onChange = viewModel::onPassword,
                    placeholder = "••••••••",
                    icon = Lucide.Eye,
                    imeAction = ImeAction.Done,
                    onDone = viewModel::submit,
                    password = true,
                )
                state.error?.let {
                    Notice(it)
                    Spacer(Modifier.height(14.dp))
                }
                val name = state.companyName
                SubmitButton(
                    when {
                        state.busy -> "Entrando…"
                        name != null -> "Entrar a ${shortTenant(name)}"
                        else -> "Entrar"
                    },
                    Lucide.LogIn,
                    state.busy,
                    viewModel::submit,
                )
                Spacer(Modifier.height(6.dp))
                TextLink("¿No es tu empresa? Cambiar", viewModel::back)
            }
        }
        Footer()
    }
}

@Composable
fun ChangePasswordScreen(viewModel: ChangePasswordViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    LoginScaffold(companyName = null) {
        Badge("Contraseña provisional")
        Heading("Cambia tu contraseña", "Tu cuenta tiene una contraseña provisional. Elige una nueva para continuar.")
        Spacer(Modifier.height(22.dp))
        PillField("Contraseña actual", state.current, viewModel::onCurrent, "••••••••", Lucide.KeyRound, password = true)
        PillField("Nueva contraseña", state.next, viewModel::onNext, "Mínimo 6 caracteres", Lucide.KeyRound, password = true)
        PillField(
            "Confirma la nueva contraseña",
            state.confirm,
            viewModel::onConfirm,
            "••••••••",
            Lucide.KeyRound,
            imeAction = ImeAction.Done,
            onDone = viewModel::submit,
            password = true,
        )
        state.error?.let {
            Notice(it)
            Spacer(Modifier.height(14.dp))
        }
        SubmitButton(if (state.busy) "Guardando…" else "Guardar y entrar", Lucide.ShieldCheck, state.busy, viewModel::submit)
        Spacer(Modifier.height(6.dp))
        TextLink("Salir", viewModel::signOut)
        Footer()
    }
}
