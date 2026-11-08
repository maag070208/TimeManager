package com.axzydev.checklab.auth

import kotlin.test.Test
import kotlin.test.assertEquals

class CredentialQrTest {
    private val me = Me(
        id = "00000000-0000-0000-0000-000000000001",
        username = "maria",
        name = " María G. Hernández ",
        role = "CLIENT_STAFF",
        employeeNumber = " 1234 ",
        jobTitle = "Recepcionista",
        department = Department("d1", "Recepción"),
    )

    @Test
    fun elQrEsElMismoJsonV2QueLaWeb() {
        assertEquals(
            """{"v":2,"id":"00000000-0000-0000-0000-000000000001","no":"1234","name":"María G. Hernández","pos":"Recepcionista","dept":"Recepción"}""",
            credentialQrPayload(me),
        )
    }

    @Test
    fun losCamposVaciosNoVanEnElQr() {
        assertEquals(
            """{"v":2,"id":"00000000-0000-0000-0000-000000000001","name":"María G. Hernández"}""",
            credentialQrPayload(me.copy(employeeNumber = "", jobTitle = "  ", department = null)),
        )
    }
}
