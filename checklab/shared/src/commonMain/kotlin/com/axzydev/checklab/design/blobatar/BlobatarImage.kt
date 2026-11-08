package com.axzydev.checklab.design.blobatar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private sealed interface Drawable {
    val color: Color
    class Shape(val path: Path, override val color: Color) : Drawable
    class Dot(val center: Offset, val radius: Float, override val color: Color) : Drawable
}

internal fun hexColor(hex: String): Color = Color(0xFF000000 or hex.removePrefix("#").toLong(16))

/**
 * Blobatar nativo: las marcas de [Blobatar.figure] dibujadas en un Canvas de
 * 100×100 escalado, sin imágenes ni SVG de por medio.
 */
@Composable
fun BlobatarImage(name: String, modifier: Modifier = Modifier, size: Dp = 40.dp, description: String? = null) {
    val drawables = remember(name) {
        Blobatar.figure(name).marks.map { mark ->
            when (mark) {
                is BlobatarMark.Path -> Drawable.Shape(PathParser().parsePathString(mark.d).toPath(), hexColor(mark.fill))
                is BlobatarMark.Circle -> Drawable.Dot(Offset(mark.cx.toFloat(), mark.cy.toFloat()), mark.r.toFloat(), hexColor(mark.fill))
            }
        }
    }
    Canvas(
        modifier
            .size(size)
            .semantics { if (description != null) contentDescription = description },
    ) {
        scale(this.size.width / 100f, this.size.height / 100f, pivot = Offset.Zero) {
            for (d in drawables) {
                when (d) {
                    is Drawable.Shape -> drawPath(d.path, d.color)
                    is Drawable.Dot -> drawCircle(d.color, d.radius, d.center)
                }
            }
        }
    }
}
