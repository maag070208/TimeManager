package com.axzydev.checklab.core.location

import androidx.compose.runtime.Composable

/** Un punto del momento de la checada. No hay rastreo: se pide una vez y se olvida. */
data class GeoFix(val latitude: Double, val longitude: Double, val accuracyMeters: Double)

sealed interface LocationResult {
    data class Found(val fix: GeoFix) : LocationResult
    /** La persona no dio permiso (o lo quitó). */
    data object Denied : LocationResult
    /** Con permiso, pero sin señal o sin servicio de ubicación a tiempo. */
    data object Unavailable : LocationResult
}

fun interface LocationProvider {
    /** Pide permiso si hace falta y devuelve la ubicación actual, con un tope de espera. */
    suspend fun current(): LocationResult
}

/** Proveedor nativo ligado a la pantalla (en Android necesita la Activity para pedir permiso). */
@Composable
expect fun rememberLocationProvider(): LocationProvider
