package com.marazul.rastreador

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Reinicia el rastreo automáticamente cuando la tablet se enciende,
 * si el usuario había dejado el servicio activo.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            if (Prefs.isActive(context) && Prefs.getToken(context).isNotBlank()) {
                RastreoService.iniciar(context)
            }
        }
    }
}
