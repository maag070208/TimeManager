package com.axzydev.checklab.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Tokens del paquete de marca (`brand/CheckLab-brand-package/README.md`). */
object Brand {
    val Navy = Color(0xFF1D2636)
    val Navy2 = Color(0xFF2A3850)
    val Paper = Color(0xFFF4F6FA)
    val Surface = Color(0xFFFFFFFF)
    val Mint = Color(0xFF34D399)
    val MintInk = Color(0xFF0E9F6E)
    val MintSoft = Color(0x1F0E9F6E)
    val Amber = Color(0xFFF59E0B)
    val AmberInk = Color(0xFFA35A00)
    val AmberSoft = Color(0x24F59E0B)
    val Rose = Color(0xFFBA1A1A)
    val RoseSoft = Color(0x1FBA1A1A)
    val Ink = Color(0xFF111A2B)
    val Muted = Color(0xFF5B667A)
    val Line = Color(0xFFEEF1F5)
    val LineStrong = Color(0xFFDDE3EC)
}

object Radius {
    val Card = 20.dp
    val Control = 14.dp
    val Pill = 999.dp
}

private val Colors = lightColorScheme(
    primary = Brand.Navy,
    onPrimary = Brand.Paper,
    secondary = Brand.MintInk,
    onSecondary = Color.White,
    tertiary = Brand.Amber,
    background = Brand.Paper,
    onBackground = Brand.Ink,
    surface = Brand.Surface,
    onSurface = Brand.Ink,
    surfaceVariant = Brand.Paper,
    onSurfaceVariant = Brand.Muted,
    outline = Brand.LineStrong,
    outlineVariant = Brand.Line,
    error = Brand.Rose,
)

private val Type = Typography(
    headlineLarge = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.5).sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 28.sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp),
)

@Composable
fun CheckLabTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Colors,
        typography = Type,
        shapes = Shapes(
            small = RoundedCornerShape(Radius.Control),
            medium = RoundedCornerShape(Radius.Card),
            large = RoundedCornerShape(Radius.Card),
        ),
        content = content,
    )
}
