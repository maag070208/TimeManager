package com.axzydev.checklab.design.blobatar

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cbrt
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * Port a Kotlin Multiplatform de blobatar 2.7.0 (núcleo estático: nombre → figura).
 * https://github.com/Alain00/blobatar — MIT License, Copyright (c) 2026 Alain.
 *
 * Mismo algoritmo y mismas constantes que `src/{hash,traits,shape,color}.ts` y
 * `src/styles/{blob,compose,shapes}.ts`, para que un nombre dé la misma figura en
 * la web y en la app. `BlobatarParityTest` compara contra SVG generados con la
 * librería original. Fuera de alcance: animación, expresiones y fondo (la web
 * usa el estilo `blob` sin fondo).
 */

/** NFC para que "é" precompuesta y descompuesta den el mismo hash. */
internal expect fun normalizeNfc(value: String): String

// ── hash.ts ────────────────────────────────────────────────────────────────

private const val SEP = 0xff

private fun feed(state: Int, bytes: ByteArray): Int {
    var h = state
    for (b in bytes) {
        h = (h xor (b.toInt() and 0xff)) * -862048943 // 3432918353 como Int32
        h = (h shl 13) or (h ushr 19)
    }
    return h
}

private fun finalize(state: Int): Long {
    var h = state
    h = (h xor (h ushr 16)) * -2048144789 // 2246822507
    h = (h xor (h ushr 13)) * -1028477387 // 3266489909
    return (h xor (h ushr 16)).toLong() and 0xffffffffL
}

fun normalizeSeed(seed: String): String = normalizeNfc(seed).trim().lowercase()

private fun seedState(seed: String, normalize: Boolean): Int {
    val s = if (normalize) normalizeSeed(seed) else seed
    return feed(1779033703 xor s.length, s.encodeToByteArray())
}

private fun stream(state: Int, key: String): Double =
    finalize(feed(feed(state, byteArrayOf(SEP.toByte())), key.encodeToByteArray())) / 4294967296.0

// ── traits.ts ──────────────────────────────────────────────────────────────

internal class Traits(seed: String, normalize: Boolean = true) {
    private val state = seedState(seed, normalize)
    operator fun invoke(key: String): Double = stream(state, key)
    fun num(key: String, min: Double, max: Double): Double = min + this(key) * (max - min)
    fun int(key: String, min: Int, max: Int): Int = min + floor(this(key) * (max - min + 1)).toInt()
    fun jitter(key: String, amount: Double): Double = (this(key) * 2 - 1) * amount
}

// ── shape.ts ───────────────────────────────────────────────────────────────

/** `String(Math.round(v * 100) / 100)` de JS, con `-0` como "0". */
internal fun r2(v: Double): String {
    val cents = floor(v * 100 + 0.5).toLong()
    if (cents == 0L) return "0"
    val sign = if (cents < 0) "-" else ""
    val a = abs(cents)
    val whole = a / 100
    val frac = a % 100
    return when {
        frac == 0L -> "$sign$whole"
        frac % 10 == 0L -> "$sign$whole.${frac / 10}"
        else -> "$sign$whole.${frac.toString().padStart(2, '0')}"
    }
}

private fun round2(v: Double): Double = floor(v * 100 + 0.5) / 100

internal fun superellipse(cx: Double, cy: Double, rx: Double, ry: Double, n: Double = 4.0, rot: Double = 0.0): String {
    val k = min(1.0, (8 * 2.0.pow(-1 / n) - 4) / 3)
    val ak = rx * k
    val bk = ry * k
    val pts = arrayOf(
        rx to 0.0,
        rx to bk, ak to ry, 0.0 to ry,
        -ak to ry, -rx to bk, -rx to 0.0,
        -rx to -bk, -ak to -ry, 0.0 to -ry,
        ak to -ry, rx to -bk, rx to 0.0,
    )
    val t = rot * PI / 180
    val c = cos(t)
    val s = sin(t)
    fun at(i: Int): String {
        val (x, y) = pts[i]
        return "${r2(cx + x * c - y * s)} ${r2(cy + x * s + y * c)}"
    }
    val d = StringBuilder("M${at(0)}")
    var i = 1
    while (i < 13) {
        d.append("C${at(i)} ${at(i + 1)} ${at(i + 2)}")
        i += 3
    }
    return d.append("Z").toString()
}

private fun blobPath(cx: Double, cy: Double, rx: Double, ry: Double, radii: List<Double>, rot: Double): String {
    val n = radii.size
    val t0 = rot * PI / 180
    val p = radii.mapIndexed { i, m ->
        val a = t0 + 2 * PI * i / n
        (cx + rx * m * cos(a)) to (cy + ry * m * sin(a))
    }
    fun at(i: Int) = p[((i % n) + n) % n]
    val d = StringBuilder("M${r2(at(0).first)} ${r2(at(0).second)}")
    for (i in 0 until n) {
        val (x0, y0) = at(i - 1)
        val (x1, y1) = at(i)
        val (x2, y2) = at(i + 1)
        val (x3, y3) = at(i + 2)
        d.append("C${r2(x1 + (x2 - x0) / 6)} ${r2(y1 + (y2 - y0) / 6)}")
        d.append(" ${r2(x2 - (x3 - x1) / 6)} ${r2(y2 - (y3 - y1) / 6)}")
        d.append(" ${r2(x2)} ${r2(y2)}")
    }
    return d.append("Z").toString()
}

private fun polygon(cx: Double, cy: Double, rx: Double, ry: Double, sides: Int, round: Double, rot: Double): String {
    val k = if (round > 0) (if (round < 1) round / 2 else 0.5) else 0.0
    val t0 = rot * PI / 180 - PI / 2
    val v = List(sides) { i ->
        val a = t0 + 2 * PI * i / sides
        (cx + rx * cos(a)) to (cy + ry * sin(a))
    }
    fun at(i: Int) = v[((i % sides) + sides) % sides]
    fun cut(i: Int, j: Int): String {
        val (x0, y0) = at(i)
        val (x1, y1) = at(j)
        return "${r2(x0 + (x1 - x0) * k)} ${r2(y0 + (y1 - y0) * k)}"
    }
    val d = StringBuilder("M${cut(0, -1)}")
    for (i in 0 until sides) {
        val (x, y) = at(i)
        d.append("Q${r2(x)} ${r2(y)} ${cut(i, i + 1)}")
        if (k < 0.5) d.append("L${cut(i + 1, i)}")
    }
    return d.append("Z").toString()
}

private fun box(cx: Double, cy: Double, rx: Double, ry: Double): String {
    val l = r2(cx - rx)
    val r = r2(cx + rx)
    return "M$l ${r2(cy - ry)}H${r}V${r2(cy + ry)}H${l}Z"
}

private fun taper(cx: Double, cy: Double, rx: Double, ry: Double, tip: Double): String {
    val t = max(1.05, tip)
    val tx = rx * sqrt(1 - 1 / (t * t))
    val ty = cy - ry / t
    val apex = cy - t * ry
    val px = tx * 0.14
    val py = ty + 0.86 * (apex - ty)
    return "M${r2(cx - tx)} ${r2(ty)}" +
        "L${r2(cx - px)} ${r2(py)}" +
        "Q${r2(cx)} ${r2(apex)} ${r2(cx + px)} ${r2(py)}" +
        "L${r2(cx + tx)} ${r2(ty)}Z"
}

// ── styles/shapes.ts ───────────────────────────────────────────────────────

private class Body(
    var cx: Double, var cy: Double, var rx: Double, var ry: Double,
    var n: Double, var rot: Double, val radii: List<Double>,
    var sides: Int = 0, var round: Double = 0.3,
)

private data class Ellipse(val cx: Double, val cy: Double, val rx: Double, val ry: Double)
private data class Petal(val cx: Double, val cy: Double, val r: Double)

private class Deco {
    val petals = mutableListOf<Petal>()
    val extra = mutableListOf<String>()
}

private class Shape(
    val name: String,
    val core: Double,
    val body: ((Traits, Body) -> Unit)? = null,
    val face: ((Body) -> Ellipse)? = null,
    val decorate: ((Traits, Body, Deco) -> Unit)? = null,
    val path: ((Body) -> String)? = null,
)

private val poly = { b: Body -> polygon(b.cx, b.cy, b.rx, b.ry, b.sides, b.round, b.rot) }
private val spline = { b: Body -> blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, b.rot) }
private fun shrunk(k: Double) = { b: Body -> Ellipse(b.cx, b.cy, b.rx * k, b.ry * k) }
private val splineFace = { b: Body -> shrunk(b.radii.min() * 0.95)(b) }
private val polyFace = { b: Body -> shrunk(0.84)(b) }

private val ROUND = Shape("round", 1.0)
private val ORGANIC = Shape("organic", 0.98, path = spline, face = splineFace)
private val BOXY = Shape("boxy", 0.86, body = { t, b ->
    b.n = t.num("body.n", 3.4, 6.0)
    b.rot = t.num("body.rot", -20.0, 20.0)
})
private val CAPSULE = Shape(
    "capsule", 1.02,
    body = { t, b -> b.ry *= t.num("capsule.squat", 0.55, 0.68) },
    face = shrunk(0.94),
    decorate = { _, b, out -> for (s in intArrayOf(-1, 1)) out.petals += Petal(b.cx + s * (b.rx - b.ry), b.cy, b.ry) },
    path = { b -> box(b.cx, b.cy, b.rx - b.ry, b.ry) },
)
private val NUB = Shape("nub", 0.88, decorate = { t, b, out ->
    val count = t.int("nub.n", 1, 2)
    for (i in 0 until count) {
        val a = t.num("nub.a$i", 0.0, 2 * PI)
        out.petals += Petal(b.cx + cos(a) * b.rx * 0.88, b.cy + sin(a) * b.rx * 0.88, b.rx * t.num("nub.r$i", 0.24, 0.4))
    }
})
private val CLOUD = Shape("cloud", 0.78, face = splineFace, path = spline, decorate = { t, b, out ->
    val count = t.int("cloud.n", 4, 6)
    for (i in 0 until count) {
        val a = PI + PI * (i + 0.5) / count
        out.petals += Petal(b.cx + cos(a) * b.rx * 0.8, b.cy + sin(a) * b.rx * 0.5, b.rx * t.num("cloud.r$i", 0.44, 0.62))
    }
})
private val DROPLET = Shape(
    "droplet", 0.78,
    body = { _, b ->
        b.cy += 0.22 * b.ry
        b.n = 2.0
    },
    face = { b -> Ellipse(b.cx, b.cy + b.ry * 0.05, b.rx * 0.88, b.ry * 0.88) },
    decorate = { t, b, out -> out.extra += taper(b.cx, b.cy, b.rx, b.ry, t.num("droplet.tip", 1.4, 1.65)) },
)
private val HEXAGON = Shape("hexagon", 1.05, path = poly, face = polyFace, body = { t, b ->
    b.sides = 6
    b.rot = t.num("body.rot", -12.0, 12.0)
    b.round = t.num("poly.round", 0.24, 0.5)
})
private val SUN = Shape("sun", 0.7, decorate = { t, b, out ->
    val count = t.int("sun.n", 6, 9)
    val dist = b.rx * t.num("sun.dist", 1.0, 1.08)
    val pr = b.rx * t.num("sun.r", 0.2, 0.26)
    val off = t.num("sun.rot", 0.0, 2 * PI)
    for (i in 0 until count) {
        val a = off + 2 * PI * i / count
        out.petals += Petal(b.cx + cos(a) * dist, b.cy + sin(a) * dist, pr)
    }
})
private val TRIANGLE = Shape(
    "triangle", 1.15, path = poly,
    body = { t, b ->
        b.sides = 3
        b.rot = t.num("body.rot", -5.0, 5.0)
        b.round = t.num("poly.round", 0.24, 0.5)
    },
    face = { b -> Ellipse(b.cx, b.cy + b.ry * 0.1, b.rx * 0.54, b.ry * 0.36) },
)

/** `styles/blob.ts`: umbrales acumulados, congelados por versión mayor. */
private val BANDS = listOf(
    ROUND to 0.22, ORGANIC to 0.48, BOXY to 0.6, CAPSULE to 0.7, NUB to 0.79,
    CLOUD to 0.86, DROPLET to 0.915, HEXAGON to 0.95, SUN to 0.98, TRIANGLE to 1.0,
)

// ── styles/compose.ts ──────────────────────────────────────────────────────

private class Eye(val cx: Double, val cy: Double, val rx: Double, val ry: Double, val n: Double, val rot: Double)

private fun faceFit(t: Traits, b: Body, face: Ellipse): List<Eye> {
    val rx = b.rx
    val er0 = t.num("eye.rx", 0.075, 0.105) * rx
    val ratio = t.num("eye.ratio", 1.9, 3.2)
    val scale = t.num("eye.scale", 0.78, 1.24)
    val stretch = t.num("eye.stretch", 0.85, 1.18)
    val clearance = t.num("eye.gap", 0.1, 0.24) * rx
    val wide = er0 * max(1.0, scale)
    val tall = er0 * ratio * max(1.0, scale * stretch)
    val gap0 = wide + rx * 0.03 + clearance

    val gx = t.jitter("gaze.x", 0.09) * face.rx
    val gy = t.num("gaze.y", -0.2, 0.08) * face.ry
    val dy = t.jitter("eye.dy", 0.04) * face.ry
    val reach = hypot(wide, tall)
    val need = hypot((abs(gx) + gap0 + reach) / face.rx, (abs(gy) + abs(dy) + reach) / face.ry)
    val fit = if (need > 0.9) 0.9 / need else 1.0

    val er = er0 * fit
    val eyeRy = er * ratio
    val gap = gap0 * fit
    val room = max(0.0, min(1.0, clearance / tall))
    val bound = min(12.0, asin(room) * 180 / PI)
    val lean = t.num("eye.lean", -1.0, 1.0) * bound
    val lean2 = max(-12.0, min(12.0, lean + t.jitter("eye.lean2", 3.5)))

    val cx = face.cx + gx * fit
    val cy = face.cy + gy * fit
    val n = t.num("eye.n", 3.5, 6.0)
    return listOf(
        Eye(cx - gap, cy, er, eyeRy, n, lean),
        Eye(cx + gap, cy + dy * fit, er * scale, eyeRy * scale * stretch, n, lean2),
    )
}

// ── color.ts ───────────────────────────────────────────────────────────────

private data class Oklch(val l: Double, val c: Double, val h: Double)

private fun toLinear(color: Oklch): DoubleArray {
    val r = color.h * PI / 180
    val a = color.c * cos(r)
    val b = color.c * sin(r)
    val l = color.l + 0.3963377774 * a + 0.2158037573 * b
    val m = color.l - 0.1055613458 * a - 0.0638541728 * b
    val s = color.l - 0.0894841775 * a - 1.291485548 * b
    val ll = l * l * l
    val mm = m * m * m
    val ss = s * s * s
    return doubleArrayOf(
        4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
        -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
        -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
    )
}

private fun inGamut(rgb: DoubleArray) = rgb.all { it >= -1e-4 && it <= 1 + 1e-4 }

private fun resolveRgb(color: Oklch): DoubleArray {
    var rgb = toLinear(color)
    if (!inGamut(rgb)) {
        var lo = 0.0
        var hi = color.c
        repeat(12) {
            val mid = (lo + hi) / 2
            if (inGamut(toLinear(color.copy(c = mid)))) lo = mid else hi = mid
        }
        rgb = toLinear(color.copy(c = lo))
    }
    return DoubleArray(3) { min(1.0, max(0.0, rgb[it])) }
}

private fun luminance(color: Oklch): Double {
    val (r, g, b) = resolveRgb(color)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

private fun contrast(a: Oklch, b: Oklch): Double {
    val x = luminance(a)
    val y = luminance(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)
}

private fun ensureContrast(fg: Oklch, bg: Oklch, minRatio: Double): Oklch {
    if (contrast(fg, bg) >= minRatio) return fg
    val lean = if (fg.l >= bg.l) 1 else -1
    for (dir in intArrayOf(lean, -lean)) {
        var probe = fg
        for (i in 0 until 60) {
            probe = probe.copy(l = min(1.0, max(0.0, probe.l + dir * 0.02)))
            if (contrast(probe, bg) >= minRatio) return probe
            if (probe.l == 0.0 || probe.l == 1.0) break
        }
    }
    val black = fg.copy(l = 0.0, c = 0.0)
    val white = fg.copy(l = 1.0, c = 0.0)
    return if (contrast(black, bg) >= contrast(white, bg)) black else white
}

private fun toHex(color: Oklch): String = "#" + resolveRgb(color).joinToString("") { v ->
    val s = if (v <= 0.0031308) 12.92 * v else 1.055 * v.pow(1 / 2.4) - 0.055
    floor(s * 255 + 0.5).toInt().toString(16).padStart(2, '0')
}

private val TONES = listOf(
    0.2 to Oklch(0.86, 0.085, 0.0), // pastel
    0.36 to Oklch(0.9, 0.028, 0.0), // neutro pálido
    0.62 to Oklch(0.73, 0.135, 0.0), // medio
    0.8 to Oklch(0.62, 0.165, 0.0), // profundo
    0.93 to Oklch(0.87, 0.16, 0.0), // brillante
    1.0 to Oklch(0.34, 0.035, 0.0), // tinta
)

private val DARK_SURFACE = Oklch(0.145, 0.0, 0.0)
private const val SURFACE_FLOOR = 1.5

/** Colores en hex como `#rrggbb`: fondo (no se dibuja en el estilo `blob`), cuerpo y ojos. */
data class BlobatarPalette(val bg: String, val head: String, val eye: String)

private fun palette(hue: Double, tone: Double): BlobatarPalette {
    val swatch = (TONES.firstOrNull { tone < it.first } ?: TONES[0]).second
    val bg = Oklch(0.965, 0.01, hue)
    var head = ensureContrast(Oklch(swatch.l, swatch.c, hue), DARK_SURFACE, SURFACE_FLOOR)
    var eye = if (head.l >= 0.5) Oklch(0.17, 0.02, hue) else Oklch(0.97, 0.012, hue)
    head = ensureContrast(head, bg, 1.25)
    eye = ensureContrast(eye, head, 4.5)
    return BlobatarPalette(toHex(bg), toHex(head), toHex(eye))
}

// ── API pública ────────────────────────────────────────────────────────────

/** Una primitiva de dibujo en el viewBox 0..100 (`_marks` de la librería). */
sealed interface BlobatarMark {
    val fill: String
    data class Path(val d: String, override val fill: String) : BlobatarMark
    data class Circle(val cx: Double, val cy: Double, val r: Double, override val fill: String) : BlobatarMark
}

class BlobatarFigure(val shape: String, val palette: BlobatarPalette, val marks: List<BlobatarMark>) {
    /** El mismo SVG que `blobatar(name, { size })` de la librería original. */
    fun svg(size: Int? = null): String {
        val dim = if (size != null) " width=\"$size\" height=\"$size\"" else ""
        fun draw(list: List<BlobatarMark>) = list.joinToString("") { m ->
            when (m) {
                is BlobatarMark.Circle -> "<circle cx=\"${r2(m.cx)}\" cy=\"${r2(m.cy)}\" r=\"${r2(m.r)}\"/>"
                is BlobatarMark.Path -> "<path d=\"${m.d}\"/>"
            }
        }
        // Los ojos son siempre las dos últimas marcas, como en `marks()` de la librería.
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"$dim>" +
            "<g fill=\"${palette.head}\">${draw(marks.dropLast(2))}</g>" +
            "<g fill=\"${palette.eye}\">${draw(marks.takeLast(2))}</g></svg>"
    }
}

object Blobatar {
    private val cache = mutableMapOf<String, BlobatarFigure>()

    /** Figura determinista para `name`: mismo nombre, misma figura que en la web. */
    fun figure(name: String): BlobatarFigure = cache.getOrPut(name) { build(name) }

    private fun build(name: String): BlobatarFigure {
        val t = Traits(name)
        val pal = palette(t.num("hue", 0.0, 360.0), t("tone"))

        val v = t("shape")
        val shape = (BANDS.firstOrNull { v < it.second } ?: BANDS.last()).first
        val r = t.num("body.r", 31.0, 38.0) * shape.core
        val body = Body(
            cx = 50 + t.jitter("body.x", 1.5),
            cy = 50 + t.jitter("body.y", 1.5),
            rx = r,
            ry = r * t.num("body.ratio", 0.92, 1.08),
            n = t.num("body.n", 1.9, 2.5),
            rot = 0.0,
            radii = List(t.int("body.pts", 6, 8)) { i -> 1 + t.jitter("body.r$i", 0.16) },
        )
        shape.body?.invoke(t, body)
        val face = shape.face?.invoke(body) ?: Ellipse(body.cx, body.cy, body.rx, body.ry)
        val deco = Deco()
        shape.decorate?.invoke(t, body, deco)
        val eyes = faceFit(t, body, face)

        val marks = buildList<BlobatarMark> {
            deco.petals.forEach { add(BlobatarMark.Circle(round2(it.cx), round2(it.cy), round2(it.r), pal.head)) }
            deco.extra.forEach { add(BlobatarMark.Path(it, pal.head)) }
            add(BlobatarMark.Path(shape.path?.invoke(body) ?: superellipse(body.cx, body.cy, body.rx, body.ry, body.n, body.rot), pal.head))
            eyes.forEach { add(BlobatarMark.Path(superellipse(it.cx, it.cy, it.rx, it.ry, it.n, it.rot), pal.eye)) }
        }
        return BlobatarFigure(shape.name, pal, marks)
    }
}
