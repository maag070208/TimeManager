package com.axzydev.checklab.navigation

import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.auth.PermissionScope
import com.axzydev.checklab.auth.TenantInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private val tenant = TenantInfo("t1", "altamira", "Grupo Logístico Altamira", "America/Mexico_City")

private fun me(vararg permissions: String) = Me(
    id = "u", username = "u", name = "Persona Demo", role = "X",
    tenant = tenant,
    permissions = permissions.associateWith { PermissionScope.ALL },
)

private fun ids(me: Me) = visibleMenu(me).flatMap { s -> s.items.map { it.id } }

class MenuTest {
    @Test
    fun elPersonalSoloVeSuInicioJornadaYAvisos() {
        assertEquals(listOf(HOME, "myWorkday", "notifications", "profile"), ids(me("attendance.view")))
    }

    @Test
    fun cadaPantallaSaleConSuPermisoComoEnLaWeb() {
        val rh = ids(me("hr.records", "time_clock.view", "overtime.view"))
        assertTrue("employees" in rh && "employeeRecords" in rh && "attendance" in rh && "overtime" in rh)
        assertTrue("payroll" !in rh && "roles" !in rh && "tenants" !in rh)
    }

    @Test
    fun laConsolaDePlataformaNoEstaEnLaApp() {
        val all = MENU.flatMap { s -> s.items.map { it.id } }
        assertTrue("tenants" !in all && "plans" !in all)
    }

    @Test
    fun unaSeccionSinEntradasVisiblesNoSeMuestra() {
        val titles = visibleMenu(me("attendance.view")).map { it.title }
        assertEquals(listOf<String?>(null), titles)
    }

    @Test
    fun laBarraInferiorTieneLasSeccionesBaseYMenuAlFinal() {
        val tabs = bottomTabs(me("attendance.view"))
        assertEquals(listOf(HOME, MY_WORKDAY, "notifications", "profile", MENU_TAB), tabs.map { it.id })
        assertEquals(listOf("Inicio", "Mi jornada", "Avisos", "Perfil", "Menú"), tabs.map { it.label })
    }

    @Test
    fun cadaPestanaDeSeccionAbreUnaSeccionQueExiste() {
        bottomTabs(me()).filter { it.id != MENU_TAB }.forEach { assertTrue(menuItem(it.id) != null, "sin sección: ${it.id}") }
    }

    @Test
    fun enUnaSeccionDelDrawerSeMarcaMenu() {
        val tabs = bottomTabs(me("payroll.view"))
        assertEquals("profile", selectedTab("profile", tabs))
        assertEquals(HOME, selectedTab(HOME, tabs))
        assertEquals(MENU_TAB, selectedTab("payroll", tabs))
    }
}
