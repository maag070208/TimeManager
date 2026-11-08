package com.axzydev.checklab.navigation

import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.design.Lucide
import com.axzydev.checklab.design.LucideIcon

/**
 * Una entrada del drawer. `anyOf` vacío = visible para cualquier sesión.
 */
data class MenuItem(
    val id: String,
    val label: String,
    val icon: LucideIcon,
    val anyOf: List<String> = emptyList(),
) {
    fun visibleFor(me: Me): Boolean = anyOf.isEmpty() || anyOf.any(me::can)
}

data class MenuSection(val title: String?, val items: List<MenuItem>)

const val HOME = "start"
const val MY_WORKDAY = "myWorkday"

/**
 * Espejo de `APP_SCREENS` (`web/src/entities/permission/model/screens.ts`) para
 * el cliente: mismas secciones, etiquetas y permisos. La consola de plataforma
 * se queda en la web. La autorización real la decide el API.
 */
val MENU: List<MenuSection> = listOf(
    MenuSection(
        null,
        listOf(
            MenuItem(HOME, "Inicio", Lucide.House),
            MenuItem(MY_WORKDAY, "Mi jornada", Lucide.CalendarCheck),
            MenuItem("notifications", "Notificaciones", Lucide.Bell),
            MenuItem("profile", "Mi perfil", Lucide.User),
        ),
    ),
    MenuSection(
        "Recursos Humanos",
        listOf(
            MenuItem("employees", "Personal", Lucide.Users, listOf("hr.records", "users.view")),
            MenuItem("employeeRecords", "Expedientes", Lucide.FolderOpen, listOf("hr.records")),
            MenuItem("hrReports", "Actas administrativas", Lucide.MessageSquareWarning, listOf("hr.records")),
            MenuItem("departments", "Departamentos", Lucide.Building, listOf("departments.manage")),
            MenuItem("attendance", "Asistencias", Lucide.Clock, listOf("time_clock.view")),
            MenuItem("leave", "Vacaciones y permisos", Lucide.Plane, listOf("time_clock.write")),
            MenuItem("workdayAgreements", "Convenios y acuerdos", Lucide.Handshake, listOf("time_clock.write")),
            MenuItem("telework", "Teletrabajo (NOM-037)", Lucide.Laptop, listOf("time_clock.view")),
        ),
    ),
    MenuSection(
        "Horarios y nómina",
        listOf(
            MenuItem("schedules", "Horarios", Lucide.CalendarDays, listOf("schedules.view")),
            MenuItem("schedulesAssign", "Asignar horarios", Lucide.ArrowLeftRight, listOf("schedules.view")),
            MenuItem("overtime", "Tiempo extra", Lucide.Timer, listOf("overtime.view")),
            MenuItem("payroll", "Pre Nómina", Lucide.Wallet, listOf("payroll.view")),
            MenuItem("payrollSettings", "Puestos de nómina", Lucide.Briefcase, listOf("payroll.close")),
        ),
    ),
    MenuSection(
        "Configuración",
        listOf(
            MenuItem("clockDashboard", "Relojes", Lucide.ScanFace, listOf("time_clocks.manage", "time_clock.write")),
            MenuItem("generalSettings", "Configuración del sistema", Lucide.Settings, listOf("time_clock.write")),
            MenuItem("roles", "Roles y permisos", Lucide.ShieldCheck, listOf("roles.manage")),
            MenuItem("audit", "Auditoría", Lucide.ScrollText, listOf("audit.view")),
        ),
    ),
)

/** Secciones con al menos una entrada visible para la sesión, en el orden del menú. */
fun visibleMenu(me: Me): List<MenuSection> =
    MENU.map { s -> s.copy(items = s.items.filter { it.visibleFor(me) }) }.filter { it.items.isNotEmpty() }

fun menuItem(id: String): MenuItem? = MENU.flatMap { it.items }.firstOrNull { it.id == id }

/** Pestaña de la barra inferior: una sección del menú con etiqueta corta, o el botón que abre el drawer. */
data class BottomTab(val id: String, val label: String, val icon: LucideIcon)

const val MENU_TAB = "menu"

private val BOTTOM_SECTIONS = listOf(HOME to "Inicio", MY_WORKDAY to "Mi jornada", "notifications" to "Avisos", "profile" to "Perfil")

/** Pestañas para la sesión: las secciones base que el rol puede ver y, al final, "Menú" para el resto. */
fun bottomTabs(me: Me): List<BottomTab> =
    BOTTOM_SECTIONS.mapNotNull { (id, label) -> menuItem(id)?.takeIf { it.visibleFor(me) }?.let { BottomTab(id, label, it.icon) } } +
        BottomTab(MENU_TAB, "Menú", Lucide.Menu)

/** Pestaña marcada en la sección [current]: la suya, o "Menú" si se llegó desde el drawer. */
fun selectedTab(current: String, tabs: List<BottomTab>): String = tabs.firstOrNull { it.id == current }?.id ?: MENU_TAB
