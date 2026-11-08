package com.axzydev.checklab.navigation

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.axzydev.checklab.auth.ChangePasswordScreen
import com.axzydev.checklab.auth.Destination
import com.axzydev.checklab.auth.LoginScreen
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.auth.SessionRepository
import com.axzydev.checklab.auth.SessionState
import com.axzydev.checklab.auth.destinationFor
import com.axzydev.checklab.design.Brand
import androidx.compose.foundation.layout.ColumnScope
import androidx.navigation.toRoute
import com.axzydev.checklab.design.Notice
import com.axzydev.checklab.home.HomeContent
import com.axzydev.checklab.design.LinkButton
import com.axzydev.checklab.nom.CheckPanel
import com.axzydev.checklab.nom.MyWorkdayViewModel
import org.koin.compose.viewmodel.koinViewModel
import com.axzydev.checklab.resources.Res
import com.axzydev.checklab.resources.symbol
import kotlinx.serialization.Serializable
import org.jetbrains.compose.resources.painterResource
import org.koin.compose.koinInject

@Serializable data object SplashRoute
@Serializable data object LoginRoute
@Serializable data object ChangePasswordRoute
@Serializable data object HomeRoute
@Serializable data class SectionRoute(val id: String)

private fun Destination.route(): Any = when (this) {
    Destination.Splash -> SplashRoute
    Destination.Login -> LoginRoute
    Destination.ChangePassword -> ChangePasswordRoute
    Destination.Home -> HomeRoute
}

/**
 * Raíz de la app. La sesión decide la pantalla raíz (`destinationFor`): sin
 * sesión no se llega al inicio, y la contraseña provisional bloquea todo lo
 * demás. Cada cambio de raíz limpia la pila para que "atrás" no regrese.
 */
@Composable
fun AppNavHost(session: SessionRepository = koinInject(), nav: NavHostController = rememberNavController()) {
    val state by session.state.collectAsState()
    val destination = destinationFor(state)

    LaunchedEffect(Unit) { session.restore() }
    LaunchedEffect(destination) {
        nav.navigate(destination.route()) {
            popUpTo(nav.graph.id) { inclusive = true }
            launchSingleTop = true
        }
    }

    val me = (state as? SessionState.SignedIn)?.me
    NavHost(nav, startDestination = SplashRoute) {
        composable<SplashRoute> { Splash() }
        composable<LoginRoute> { LoginScreen(notice = (state as? SessionState.SignedOut)?.notice) }
        composable<ChangePasswordRoute> { ChangePasswordScreen() }
        composable<HomeRoute> {
            me?.let { current ->
                Shell(current, HOME, nav, session) {
                    // Checar es lo primero: el panel va arriba del inicio para todo el cliente.
                    val workday: MyWorkdayViewModel = koinViewModel()
                    LaunchedEffect(current.id) { workday.start(current) }
                    CheckPanel(current, workday, compact = true)
                    LinkButton("Ver mis marcajes y opciones", { nav.navigate(SectionRoute(MY_WORKDAY)) }, Modifier.align(Alignment.CenterHorizontally))
                    HomeContent(current)
                }
            }
        }
        composable<SectionRoute> { entry ->
            val id = entry.toRoute<SectionRoute>().id
            val item = menuItem(id)
            me?.let { current ->
                // Guard por permiso: una sección que el rol no ve no se compone aunque se llegue por ruta.
                if (item == null || !item.visibleFor(current)) {
                    Shell(current, HOME, nav, session) { Notice("No tienes acceso a esta sección.") }
                } else {
                    Shell(current, id, nav, session) { SectionContent(id, current) }
                }
            }
        }
    }
}

/** Barra, drawer y navegación entre secciones; volver siempre regresa al inicio. */
@Composable
private fun Shell(me: Me, current: String, nav: NavHostController, session: SessionRepository, content: @Composable ColumnScope.() -> Unit) {
    val item = menuItem(current)
    AppShell(
        me = me,
        current = current,
        onNavigate = { id ->
            if (id == HOME) {
                nav.popBackStack(SectionRoute::class, inclusive = true)
            } else {
                nav.navigate(SectionRoute(id)) {
                    popUpTo<SectionRoute> { inclusive = true }
                    launchSingleTop = true
                }
            }
        },
        onSignOut = { session.signOut() },
        title = if (current == HOME) "Hola, ${me.firstName}" else item?.label.orEmpty(),
        subtitle = me.tenant?.name.orEmpty(),
        content = content,
    )
}

/** Guard por permiso para pantallas internas: sin permiso no se compone el contenido. */
@Composable
fun RequirePermission(me: Me, permission: String, denied: @Composable () -> Unit = {}, content: @Composable () -> Unit) {
    if (me.can(permission)) content() else denied()
}

@Composable
private fun Splash() {
    Box(Modifier.fillMaxSize().background(Brand.Navy), contentAlignment = Alignment.Center) {
        Image(painterResource(Res.drawable.symbol), contentDescription = "CheckLab", modifier = Modifier.size(96.dp))
    }
}
