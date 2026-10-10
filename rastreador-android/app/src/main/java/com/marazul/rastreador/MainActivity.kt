package com.marazul.rastreador

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

class MainActivity : Activity() {

    private lateinit var serverInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var nameInput: EditText
    private lateinit var statusText: TextView
    private lateinit var toggleButton: Button
    private lateinit var backgroundButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(crearVista())
        cargarPrefs()
    }

    override fun onResume() {
        super.onResume()
        actualizarEstado()
    }

    private fun cargarPrefs() {
        serverInput.setText(Prefs.getServer(this))
        tokenInput.setText(Prefs.getToken(this))
        nameInput.setText(Prefs.getName(this))
    }

    private fun actualizarEstado() {
        val activo = Prefs.isActive(this)
        toggleButton.text = if (activo) "Detener rastreo" else "Guardar y activar rastreo"
        val tieneUbicacion = tienePermiso(Manifest.permission.ACCESS_FINE_LOCATION)
        val tieneSegundoPlano = tieneUbicacionSegundoPlano()
        statusText.text = buildString {
            append(if (activo) "Estado: ACTIVO" else "Estado: detenido")
            append("\n")
            append("Permiso de ubicación: ")
            append(if (tieneUbicacion) "concedido" else "FALTA")
            append("\n")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                append("Ubicación en segundo plano: ")
                append(if (tieneSegundoPlano) "concedido" else "FALTA")
                append("\n")
            }
            append("Ahorro de batería: ")
            append(if (ignoraAhorroBateria()) "desactivado" else "ACTIVO (puede cortar el rastreo)")
        }
        statusText.setTextColor(if (tieneUbicacion && activo) Color.parseColor("#065F46") else Color.parseColor("#991B1B"))
        backgroundButton.visibility = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !tieneSegundoPlano) {
            android.view.View.VISIBLE
        } else {
            android.view.View.GONE
        }
    }

    private fun alternarServicio() {
        if (Prefs.isActive(this)) {
            Prefs.setActive(this, false)
            RastreoService.detener(this)
            actualizarEstado()
            return
        }

        val server = serverInput.text.toString().trim()
        val token = tokenInput.text.toString().trim()
        if (server.isEmpty()) {
            Toast.makeText(this, "Ingresá la URL del servidor", Toast.LENGTH_LONG).show()
            return
        }
        if (token.isEmpty()) {
            Toast.makeText(this, "Ingresá el token del dispositivo", Toast.LENGTH_LONG).show()
            return
        }
        if (!tienePermiso(Manifest.permission.ACCESS_FINE_LOCATION)) {
            pedirPermisosUbicacion()
            Toast.makeText(this, "Primero concedé el permiso de ubicación", Toast.LENGTH_LONG).show()
            return
        }

        Prefs.setServer(this, server)
        Prefs.setToken(this, token)
        Prefs.setName(this, nameInput.text.toString().trim())
        Prefs.setActive(this, true)
        RastreoService.iniciar(this)
        Toast.makeText(this, "Rastreo activado", Toast.LENGTH_SHORT).show()
        actualizarEstado()
    }

    private fun tienePermiso(permiso: String): Boolean =
        ContextCompat.checkSelfPermission(this, permiso) == PackageManager.PERMISSION_GRANTED

    private fun tieneUbicacionSegundoPlano(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return tienePermiso(Manifest.permission.ACCESS_FINE_LOCATION)
        return tienePermiso(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    }

    private fun permisosBasicos(): List<String> {
        val lista = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            lista.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return lista
    }

    private fun pedirPermisosUbicacion() {
        val faltantes = permisosBasicos().filter { !tienePermiso(it) }
        if (faltantes.isNotEmpty()) {
            requestPermissions(faltantes.toTypedArray(), REQ_BASICOS)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !tieneUbicacionSegundoPlano()) {
            pedirUbicacionSegundoPlano()
        }
    }

    private fun pedirUbicacionSegundoPlano() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissions(
                arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                REQ_BACKGROUND
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQ_BASICOS -> {
                if (tienePermiso(Manifest.permission.ACCESS_FINE_LOCATION) &&
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    !tieneUbicacionSegundoPlano()
                ) {
                    pedirUbicacionSegundoPlano()
                }
            }
            REQ_BACKGROUND -> {
                if (tieneUbicacionSegundoPlano()) {
                    Toast.makeText(this, "Ubicación en segundo plano concedida", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this,
                        "Para rastrear con la pantalla apagada, elegí \"Permitir siempre\" en Configuración",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
        actualizarEstado()
    }

    private fun abrirConfiguracionUbicacion() {
        try {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        } catch (_: Exception) {
        }
    }

    private fun ignoraAhorroBateria(): Boolean {
        return try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(packageName)
        } catch (_: Exception) {
            true
        }
    }

    private fun pedirIgnorarAhorroBateria() {
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        } catch (_: Exception) {
            Toast.makeText(this, "No se pudo abrir la configuración de batería", Toast.LENGTH_LONG).show()
        }
    }

    private fun dp(valor: Int): Int = (valor * resources.displayMetrics.density).roundToInt()

    private fun etiqueta(texto: String): TextView = TextView(this).apply {
        this.text = texto
        textSize = 14f
        setTextColor(Color.parseColor("#374151"))
        setPadding(0, dp(12), 0, dp(4))
    }

    private fun campo(hint: String, tipo: Int = InputType.TYPE_CLASS_TEXT): EditText =
        EditText(this).apply {
            this.hint = hint
            inputType = tipo
            textSize = 16f
            setSingleLine(true)
        }

    private fun crearVista(): ScrollView {
        val contenedor = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(32), dp(24), dp(32))
        }

        val titulo = TextView(this).apply {
            text = "Mar Azul - Rastreo de tablets"
            textSize = 22f
            setTextColor(Color.parseColor("#0E7490"))
            gravity = Gravity.START
        }
        val subtitulo = TextView(this).apply {
            text = "Esta app envía la ubicación de la tablet a marazulapp.com de forma constante, incluso con la pantalla apagada."
            textSize = 13f
            setTextColor(Color.parseColor("#6B7280"))
            setPadding(0, dp(6), 0, dp(8))
        }

        serverInput = campo("https://marazulapp.com", InputType.TYPE_TEXT_VARIATION_URI)
        tokenInput = campo("Token generado en la página", InputType.TYPE_CLASS_TEXT)
        nameInput = campo("Ej: Tablet Camión 1")

        toggleButton = Button(this).apply {
            text = "Guardar y activar rastreo"
            setOnClickListener { alternarServicio() }
        }
        backgroundButton = Button(this).apply {
            text = "Permitir ubicación siempre"
            visibility = android.view.View.GONE
            setOnClickListener {
                if (tieneUbicacionSegundoPlano()) {
                    abrirConfiguracionUbicacion()
                } else {
                    pedirUbicacionSegundoPlano()
                }
            }
        }
        val bateriaButton = Button(this).apply {
            text = "Desactivar ahorro de batería"
            setOnClickListener { pedirIgnorarAhorroBateria() }
        }

        statusText = TextView(this).apply {
            textSize = 13f
            setPadding(0, dp(16), 0, 0)
        }

        contenedor.addView(titulo)
        contenedor.addView(subtitulo)
        contenedor.addView(etiqueta("URL del servidor"))
        contenedor.addView(serverInput)
        contenedor.addView(etiqueta("Token del dispositivo"))
        contenedor.addView(tokenInput)
        contenedor.addView(etiqueta("Nombre de la tablet (opcional)"))
        contenedor.addView(nameInput)
        contenedor.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(20), 0, 0)
            addView(toggleButton)
            addView(backgroundButton)
            addView(bateriaButton)
        })
        contenedor.addView(statusText)

        // Solicita permisos básicos al abrir por primera vez.
        if (!tienePermiso(Manifest.permission.ACCESS_FINE_LOCATION)) {
            contenedor.post { pedirPermisosUbicacion() }
        }

        return ScrollView(this).apply { addView(contenedor) }
    }

    companion object {
        private const val REQ_BASICOS = 1001
        private const val REQ_BACKGROUND = 1002
    }
}
