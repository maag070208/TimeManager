package com.axzydev.checklab.core.time

import kotlinx.datetime.DatePeriod
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock
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

/**
 * Fecha de hoy en la zona del cliente. Semanas, pre-nómina y asistencias se cortan en esa zona,
 * no en la del teléfono; sin zona válida se usa la del dispositivo.
 */
fun tenantToday(timezone: String?, now: Instant = Clock.System.now()): LocalDate {
    val zone = timezone?.let { runCatching { TimeZone.of(it) }.getOrNull() } ?: TimeZone.currentSystemDefault()
    return now.toLocalDateTime(zone).date
}

/** Semana de lunes a domingo que contiene [day], como `yyyy-MM-dd`. */
fun mondayToSunday(day: LocalDate): Pair<String, String> {
    val monday = day.minus(DatePeriod(days = day.dayOfWeek.ordinal - DayOfWeek.MONDAY.ordinal))
    return monday.toString() to monday.plus(DatePeriod(days = 6)).toString()
}

/** Minutos como `6.8 h` o `45 min`. */
fun formatMinutes(minutes: Int): String = when {
    minutes <= 0 -> "0 h"
    minutes < 60 -> "$minutes min"
    else -> {
        val tenths = (minutes * 10 + 30) / 60
        if (tenths % 10 == 0) "${tenths / 10} h" else "${tenths / 10}.${tenths % 10} h"
    }
}
