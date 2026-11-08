package com.axzydev.checklab.core.time

import kotlin.test.Test
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
    fun losMinutosSeRedondeanComoEnLaWeb() {
        assertEquals("0 h", formatMinutes(0))
        assertEquals("45 min", formatMinutes(45))
        assertEquals("6.8 h", formatMinutes(408))
        assertEquals("32.4 h", formatMinutes(1944))
        assertEquals("2 h", formatMinutes(120))
    }
}
