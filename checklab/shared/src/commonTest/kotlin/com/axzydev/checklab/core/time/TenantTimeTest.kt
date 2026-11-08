package com.axzydev.checklab.core.time

import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TenantTimeTest {
    @Test
    fun laHoraSeMuestraEnLaZonaDelCliente() {
        assertEquals("11:46", timeInZone("2026-11-07T17:46:00.000Z", "America/Mexico_City"))
        assertEquals("09:46", timeInZone("2026-11-07T17:46:00.000Z", "America/Tijuana"))
        assertNull(timeInZone("no-es-fecha", "America/Mexico_City"))
    }

    @Test
    fun laFechaCambiaSiLaZonaCruzaMedianoche() {
        assertEquals("2026-11-07 18:25", dateTimeInZone("2026-11-08T00:25:22.679Z", "America/Mexico_City"))
    }

    @Test
    fun hoyEsElDiaDeLaEmpresaAunqueEnUtcYaSeaManana() {
        val now = Instant.parse("2026-11-08T05:30:00Z")
        assertEquals(LocalDate(2026, 11, 7), tenantToday("America/Mexico_City", now))
        assertEquals(LocalDate(2026, 11, 7), tenantToday("America/Tijuana", now))
        assertEquals(LocalDate(2026, 11, 8), tenantToday("Europe/Madrid", now))
    }

    @Test
    fun unaZonaInvalidaNoTumbaLaPantalla() {
        val now = Instant.parse("2026-11-08T12:00:00Z")
        assertEquals(tenantToday(null, now), tenantToday("No/Existe", now))
    }

    @Test
    fun laSemanaVaDeLunesADomingoAunqueHoySeaDomingo() {
        assertEquals("2026-11-02" to "2026-11-08", mondayToSunday(LocalDate(2026, 11, 8)))
        assertEquals("2026-11-02" to "2026-11-08", mondayToSunday(LocalDate(2026, 11, 2)))
        assertEquals("2026-12-28" to "2027-01-03", mondayToSunday(LocalDate(2027, 1, 1)))
    }

    @Test
    fun elDomingoEnLaNocheSigueSiendoLaSemanaDeLaEmpresa() {
        // Domingo 8 nov 23:30 en CDMX = lunes 9 nov 05:30 UTC: en un teléfono en UTC ya sería otra semana.
        val now = Instant.parse("2026-11-09T05:30:00Z")
        assertEquals("2026-11-02" to "2026-11-08", mondayToSunday(tenantToday("America/Mexico_City", now)))
    }

    @Test
    fun losMinutosSeRedondeanComoEnLaWeb() {
        assertEquals("0 h", formatMinutes(0))
        assertEquals("45 min", formatMinutes(45))
        assertEquals("6.8 h", formatMinutes(408))
        assertEquals("32.4 h", formatMinutes(1944))
        assertEquals("2 h", formatMinutes(120))
    }
}
