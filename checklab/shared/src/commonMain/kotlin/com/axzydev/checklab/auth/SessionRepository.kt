package com.axzydev.checklab.auth

import com.axzydev.checklab.core.network.ApiException
import com.axzydev.checklab.core.network.ApiJson
import com.axzydev.checklab.core.network.TokenProvider
import com.axzydev.checklab.core.storage.SecureStore
import io.ktor.client.HttpClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface SessionState {
    data object Restoring : SessionState
    data class SignedOut(val notice: String? = null) : SessionState
    data class SignedIn(val me: Me) : SessionState
}

/**
 * Dueña de la sesión: tokens y `/auth/me` en el almacén cifrado, refresh con
 * un solo vuelo a la vez y cierre de sesión cuando el servidor la rechaza.
 * El cliente HTTP se construye aquí porque necesita los tokens.
 */
class SessionRepository(
    private val store: SecureStore,
    private val apiUrl: String,
    clientFactory: (TokenProvider) -> HttpClient,
) : TokenProvider {
    val client: HttpClient = clientFactory(this)
    private val api = AuthApi(client)
    private val refreshMutex = Mutex()

    private val _state = MutableStateFlow<SessionState>(SessionState.Restoring)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    /** Último código de empresa usado: se sugiere al volver al login. */
    val lastTenant: String? get() = store.get(KEY_LAST_TENANT)

    suspend fun restore() {
        if (store.get(KEY_ACCESS) == null) {
            _state.value = SessionState.SignedOut()
            return
        }
        val cached = store.get(KEY_ME)?.let { runCatching { ApiJson.decodeFromString<Me>(it) }.getOrNull() }?.takeUnless { it.isPlatform }
        if (cached != null) _state.value = SessionState.SignedIn(cached)
        try {
            saveMe(api.me())
        } catch (e: ApiException) {
            when {
                e.code == "PLATFORM_USES_WEB" -> Unit
                e.isUnauthorized -> signOut(EXPIRED)
                cached == null -> _state.value = SessionState.SignedOut(e.message)
            }
        }
    }

    suspend fun branding(slug: String): Branding {
        ensureServer()
        return api.branding(slug)
    }

    /** La app es del cliente: siempre se entra con el código de una empresa. */
    suspend fun login(tenant: String, username: String, password: String) {
        ensureServer()
        val slug = tenant.trim().lowercase()
        if (slug.isEmpty()) throw ApiException(400, "TENANT_REQUIRED", "Escribe el código de tu empresa.")
        val tokens = api.login(LoginRequest(username.trim(), password, slug))
        store.put(KEY_ACCESS, tokens.token)
        store.put(KEY_REFRESH, tokens.refreshToken)
        store.put(KEY_LAST_TENANT, slug)
        try {
            saveMe(api.me())
        } catch (e: ApiException) {
            clearTokens()
            throw e
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        api.changePassword(currentPassword, newPassword)
        saveMe(api.me())
    }

    fun signOut(notice: String? = null) {
        clearTokens()
        _state.value = SessionState.SignedOut(notice)
    }

    override fun accessToken(): String? = store.get(KEY_ACCESS)

    override suspend fun refresh(): String? {
        val seen = store.get(KEY_ACCESS)
        return refreshMutex.withLock {
            val current = store.get(KEY_ACCESS)
            if (current != null && current != seen) return@withLock current
            val refreshToken = store.get(KEY_REFRESH) ?: return@withLock null
            try {
                val fresh = api.refresh(refreshToken)
                store.put(KEY_ACCESS, fresh.token)
                store.put(KEY_REFRESH, fresh.refreshToken)
                fresh.token
            } catch (e: ApiException) {
                null
            }
        }
    }

    override suspend fun onSessionExpired() {
        if (_state.value is SessionState.SignedIn) signOut(EXPIRED)
    }

    private fun saveMe(me: Me) {
        // El equipo de CheckLab opera desde la web; una sesión sin cliente no entra a la app.
        if (me.isPlatform) {
            signOut(PLATFORM_ONLY_WEB)
            throw ApiException(403, "PLATFORM_USES_WEB", PLATFORM_ONLY_WEB)
        }
        store.put(KEY_ME, ApiJson.encodeToString(Me.serializer(), me))
        _state.value = SessionState.SignedIn(me)
    }

    private fun clearTokens() {
        store.remove(KEY_ACCESS)
        store.remove(KEY_REFRESH)
        store.remove(KEY_ME)
    }

    private fun ensureServer() {
        if (apiUrl.isBlank()) {
            throw ApiException(0, ApiException.NO_SERVER, "Esta versión de la app no tiene servidor configurado.")
        }
    }

    companion object {
        const val EXPIRED = "Tu sesión expiró. Vuelve a entrar."
        const val PLATFORM_ONLY_WEB = "La app es para las empresas cliente. El equipo de CheckLab entra desde la web."
        internal const val KEY_ACCESS = "session.access"
        internal const val KEY_REFRESH = "session.refresh"
        internal const val KEY_ME = "session.me"
        internal const val KEY_LAST_TENANT = "session.lastTenant"
    }
}

/** Pantalla raíz que corresponde a cada estado de sesión (guard global). */
enum class Destination { Splash, Login, ChangePassword, Home }

fun destinationFor(state: SessionState): Destination = when (state) {
    SessionState.Restoring -> Destination.Splash
    is SessionState.SignedOut -> Destination.Login
    is SessionState.SignedIn -> when {
        state.me.mustChangePassword -> Destination.ChangePassword
        else -> Destination.Home
    }
}
