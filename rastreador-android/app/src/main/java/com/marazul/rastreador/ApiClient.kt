package com.marazul.rastreador

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class Ubicacion(
    val latitud: Double,
    val longitud: Double,
    val precision: Float?,
    val velocidad: Float?,
    val direccion: Float?,
    val bateria: Int?,
    val proveedor: String
)

object ApiClient {
    /**
     * Envía una ubicación al backend. Devuelve true si el servidor respondió 2xx.
     * El servidor autentica la tablet con el header x-device-token.
     */
    fun enviarUbicacion(serverUrl: String, token: String, ubicacion: Ubicacion): Boolean {
        var conn: HttpURLConnection? = null
        try {
            val base = serverUrl.trim().trimEnd('/')
            val url = URL("$base/api/dispositivos/ubicacion")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 15000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("x-device-token", token)
            }

            val body = JSONObject().apply {
                put("latitud", ubicacion.latitud)
                put("longitud", ubicacion.longitud)
                ubicacion.precision?.let { put("precision", it.toDouble()) }
                ubicacion.velocidad?.let { put("velocidad", it.toDouble()) }
                ubicacion.direccion?.let { put("direccion", it.toDouble()) }
                ubicacion.bateria?.let { put("bateria", it) }
                put("proveedor", ubicacion.proveedor)
            }.toString()

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body) }
            val code = conn.responseCode
            return code in 200..299
        } catch (_: Exception) {
            return false
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Exception) {
            }
        }
    }
}
