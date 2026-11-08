package com.axzydev.checklab.home

import kotlin.test.Test
import kotlin.test.assertEquals

class AttendanceSummaryTest {
    @Test
    fun separaLlegaronDeSiguenEnSitio() {
        // El sábado del demo: 30 programados, 26 a tiempo, 2 con retardo, 2 sin llegar, 11 adentro.
        val today = AttendanceToday(
            date = "2026-11-07",
            timezone = "America/Mexico_City",
            scope = "ALL",
            counts = AttendanceCounts(PRESENT = 26, LATE = 2, NOT_ARRIVED = 2, REST = 13, onSite = 11, people = 43),
        )
        val s = today.summary()
        assertEquals(30, s.scheduled)
        assertEquals(28, s.arrived)
        assertEquals(11, s.onSite)
        assertEquals(17, s.finished)
        assertEquals(s.scheduled, s.onTime + s.late + s.missing)
    }

    @Test
    fun sinProgramadosNoDivideEntreCero() {
        val s = AttendanceToday("d", "tz", "ALL", AttendanceCounts(REST = 5)).summary()
        assertEquals(0f, s.progress)
    }
}
