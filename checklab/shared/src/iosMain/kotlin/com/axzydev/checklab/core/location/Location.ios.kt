package com.axzydev.checklab.core.location

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.useContents
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import platform.CoreLocation.CLAuthorizationStatus
import platform.CoreLocation.CLLocation
import platform.CoreLocation.CLLocationManager
import platform.CoreLocation.CLLocationManagerDelegateProtocol
import platform.CoreLocation.kCLAuthorizationStatusAuthorizedAlways
import platform.CoreLocation.kCLAuthorizationStatusAuthorizedWhenInUse
import platform.CoreLocation.kCLAuthorizationStatusDenied
import platform.CoreLocation.kCLAuthorizationStatusNotDetermined
import platform.CoreLocation.kCLAuthorizationStatusRestricted
import platform.CoreLocation.kCLLocationAccuracyBest
import platform.Foundation.NSError
import platform.darwin.NSObject

private const val TIMEOUT_MS = 12_000L

/**
 * CoreLocation con permiso "mientras se usa la app" y una sola lectura
 * (`requestLocation`): sin rastreo en segundo plano.
 */
@OptIn(ExperimentalForeignApi::class)
private class OneShotLocation : NSObject(), CLLocationManagerDelegateProtocol {
    private val manager = CLLocationManager().also {
        it.desiredAccuracy = kCLLocationAccuracyBest
    }
    private var authorization: CompletableDeferred<Boolean>? = null
    private var fix: CompletableDeferred<GeoFix?>? = null

    init {
        manager.delegate = this
    }

    private fun allowed(status: CLAuthorizationStatus) =
        status == kCLAuthorizationStatusAuthorizedWhenInUse || status == kCLAuthorizationStatusAuthorizedAlways

    suspend fun current(): LocationResult {
        val status = manager.authorizationStatus
        if (status == kCLAuthorizationStatusDenied || status == kCLAuthorizationStatusRestricted) return LocationResult.Denied
        if (status == kCLAuthorizationStatusNotDetermined) {
            val answer = CompletableDeferred<Boolean>().also { authorization = it }
            manager.requestWhenInUseAuthorization()
            if (!answer.await()) return LocationResult.Denied
        }
        val pending = CompletableDeferred<GeoFix?>().also { fix = it }
        manager.requestLocation()
        val result = withTimeoutOrNull(TIMEOUT_MS) { pending.await() }
        return result?.let { LocationResult.Found(it) } ?: LocationResult.Unavailable
    }

    override fun locationManagerDidChangeAuthorization(manager: CLLocationManager) {
        val status = manager.authorizationStatus
        if (status != kCLAuthorizationStatusNotDetermined) authorization?.complete(allowed(status))
    }

    override fun locationManager(manager: CLLocationManager, didUpdateLocations: List<*>) {
        val location = didUpdateLocations.lastOrNull() as? CLLocation ?: return
        val point = location.coordinate.useContents { latitude to longitude }
        fix?.complete(GeoFix(point.first, point.second, location.horizontalAccuracy))
    }

    override fun locationManager(manager: CLLocationManager, didFailWithError: NSError) {
        fix?.complete(null)
    }
}

@Composable
actual fun rememberLocationProvider(): LocationProvider {
    val source = remember { OneShotLocation() }
    return remember(source) { LocationProvider { source.current() } }
}
