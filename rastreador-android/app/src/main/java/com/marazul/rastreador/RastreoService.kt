package com.marazul.rastreador

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors

/**
 * Servicio en primer plano que mantiene el GPS activo y envía la ubicación
 * al servidor incluso con la pantalla apagada.
 */
class RastreoService : Service() {

    private lateinit var locationHelper: LocationHelper
    private val executor = Executors.newSingleThreadExecutor()
    private var wakeLock: PowerManager.WakeLock? = null
    private var ultimoEnvio = 0L

    override fun onCreate() {
        super.onCreate()
        crearCanal()
        locationHelper = LocationHelper(this) { location, provider ->
            manejarUbicacion(location, provider)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, construirNotificacion("Iniciando rastreo..."))
        adquirirWakeLock()
        locationHelper.start()
        return START_STICKY
    }

    private fun manejarUbicacion(location: Location, provider: String) {
        val ahora = System.currentTimeMillis()
        if (ahora - ultimoEnvio < INTERVALO_ENVIO_MS) return
        ultimoEnvio = ahora

        val server = Prefs.getServer(this)
        val token = Prefs.getToken(this)
        if (token.isBlank()) {
            actualizarNotificacion("Falta cargar el token del dispositivo")
            return
        }

        val ubicacion = Ubicacion(
            latitud = location.latitude,
            longitud = location.longitude,
            precision = if (location.hasAccuracy()) location.accuracy else null,
            velocidad = if (location.hasSpeed()) location.speed else null,
            direccion = if (location.hasBearing()) location.bearing else null,
            bateria = nivelBateria(),
            proveedor = if (provider == "gps") "gps" else "network"
        )

        val lat = location.latitude
        val lon = location.longitude
        executor.execute {
            val ok = ApiClient.enviarUbicacion(server, token, ubicacion)
            val texto = if (ok) {
                "Enviado: %.5f, %.5f".format(lat, lon)
            } else {
                "Sin conexión con el servidor"
            }
            actualizarNotificacion(texto)
        }
    }

    private fun nivelBateria(): Int? {
        return try {
            val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val nivel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            if (nivel in 0..100) nivel else null
        } catch (_: Exception) {
            null
        }
    }

    private fun adquirirWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MarAzul::Rastreo").apply {
                setReferenceCounted(false)
                acquire(12 * 60 * 60 * 1000L)
            }
        } catch (_: Exception) {
        }
    }

    private fun crearCanal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canal = NotificationChannel(
                CHANNEL_ID,
                "Rastreo Mar Azul",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Envía la ubicación de la tablet al servidor"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(canal)
        }
    }

    private fun construirNotificacion(texto: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pending = PendingIntent.getActivity(this, 0, intent, flags)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Mar Azul - Rastreo activo")
            .setContentText(texto)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun actualizarNotificacion(texto: String) {
        try {
            val manager = getSystemService(NotificationManager::class.java)
            manager.notify(NOTIF_ID, construirNotificacion(texto))
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        locationHelper.stop()
        try {
            wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
        executor.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val CHANNEL_ID = "marazul_rastreo"
        const val NOTIF_ID = 4101
        private const val INTERVALO_ENVIO_MS = 15000L

        fun iniciar(context: Context) {
            val intent = Intent(context, RastreoService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun detener(context: Context) {
            context.stopService(Intent(context, RastreoService::class.java))
        }
    }
}
