package com.axzydev.checklab.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AgreementValidationTest {
    private val ok = AgreementInput(
        userId = "u1",
        kind = "INDIVIDUAL",
        party = "WORKER",
        effectiveFrom = "2026-11-09",
        evidenceText = "Convenio de distribución de jornada nocturna.",
    )

    @Test
    fun unConvenioCompletoPasa() = assertNull(agreementProblem(ok))

    @Test
    fun sinPersonaNiHorarioSeRechaza() {
        assertEquals("Elige a la persona del convenio.", agreementProblem(ok.copy(userId = null)))
        assertEquals("Elige el horario del convenio.", agreementProblem(ok.copy(userId = null, kind = "COLECTIVO", party = "UNION")))
    }

    @Test
    fun elRangoDebeIrHaciaAdelante() {
        assertEquals("La fecha final no puede ser antes de la inicial.", agreementProblem(ok.copy(effectiveTo = "2026-11-01")))
        assertNull(agreementProblem(ok.copy(effectiveTo = "2026-11-09")))
    }

    @Test
    fun elTextoPideAlMenos20Caracteres() {
        assertEquals("Describe el convenio con al menos 20 caracteres.", agreementProblem(ok.copy(evidenceText = "  corto   ")))
    }
}
