package com.marazul.rastreador

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle

/**
 * Encapsula el LocationManager nativo (sin Google Play Services) para que
 * funcione en tablets genéricas. Reporta ubicaciones de GPS y red.
 */
class LocationHelper(
    private val context: Context,
    private val onLocation: (Location, String) -> Unit
) {
    private val locationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var started = false

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            onLocation(location, location.provider ?: "unknown")
        }

        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    @SuppressLint("MissingPermission")
    fun start() {
        if (started) return
        started = true

        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        )
        for (provider in providers) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    locationManager.requestLocationUpdates(
                        provider,
                        INTERVALO_MS,
                        0f,
                        listener,
                        context.mainLooper
                    )
                }
            } catch (_: Exception) {
            }
        }

        // Envía de inmediato la última posición conocida, si existe.
        try {
            val mejor = providers
                .mapNotNull { provider ->
                    try {
                        if (locationManager.isProviderEnabled(provider)) {
                            locationManager.getLastKnownLocation(provider)
                        } else {
                            null
                        }
                    } catch (_: Exception) {
                        null
                    }
                }
                .maxByOrNull { it.time }
            if (mejor != null) onLocation(mejor, mejor.provider ?: "unknown")
        } catch (_: Exception) {
        }
    }

    fun stop() {
        if (!started) return
        started = false
        try {
            locationManager.removeUpdates(listener)
        } catch (_: Exception) {
        }
    }

    companion object {
        const val INTERVALO_MS = 15000L
    }
}
