package com.axzydev.checklab.core.time

import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Instant

/** Hora `HH:mm` de un instante ISO en la zona del cliente (la misma regla que la web). */
fun timeInZone(iso: String, timezone: String): String? = runCatching {
    val local = Instant.parse(iso).toLocalDateTime(TimeZone.of(timezone))
    "${local.hour.toString().padStart(2, '0')}:${local.minute.toString().padStart(2, '0')}"
}.getOrNull()

/** Fecha y hora `yyyy-MM-dd HH:mm` de un instante ISO en la zona del cliente. */
fun dateTimeInZone(iso: String, timezone: String): String? = runCatching {
    val local = Instant.parse(iso).toLocalDateTime(TimeZone.of(timezone))
    "${local.date} ${local.hour.toString().padStart(2, '0')}:${local.minute.toString().padStart(2, '0')}"
}.getOrNull()

/** Minutos como `6.8 h` o `45 min`. */
fun formatMinutes(minutes: Int): String = when {
    minutes <= 0 -> "0 h"
    minutes < 60 -> "$minutes min"
    else -> {
        val tenths = (minutes * 10 + 30) / 60
        if (tenths % 10 == 0) "${tenths / 10} h" else "${tenths / 10}.${tenths % 10} h"
    }
}
