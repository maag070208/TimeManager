package com.axzydev.checklab.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Icono Lucide: trazos en un viewBox de 24 con línea de 2, como en la web. */
class LucideIcon(val paths: List<String>)

@Composable
fun Icon(icon: LucideIcon, color: Color, modifier: Modifier = Modifier, size: Dp = 18.dp, description: String? = null) {
    val parsed = remember(icon) { icon.paths.map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier.size(size).semantics { if (description != null) contentDescription = description }) {
        val k = this.size.width / 24f
        scale(k, k, pivot = Offset.Zero) {
            val stroke = Stroke(width = 2f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            parsed.forEach { drawPath(it, color, style = stroke) }
        }
    }
}
