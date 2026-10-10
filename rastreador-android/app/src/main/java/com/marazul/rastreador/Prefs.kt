package com.marazul.rastreador

import android.content.Context

object Prefs {
    private const val NAME = "marazul_prefs"
    private const val KEY_SERVER = "server_url"
    private const val KEY_TOKEN = "device_token"
    private const val KEY_NAME = "device_name"
    private const val KEY_ACTIVE = "service_active"
    const val DEFAULT_SERVER = "https://marazulapp.com"

    private fun sp(context: Context) =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun getServer(context: Context): String =
        sp(context).getString(KEY_SERVER, DEFAULT_SERVER)?.takeIf { it.isNotBlank() } ?: DEFAULT_SERVER

    fun setServer(context: Context, value: String) =
        sp(context).edit().putString(KEY_SERVER, value).apply()

    fun getToken(context: Context): String =
        sp(context).getString(KEY_TOKEN, "") ?: ""

    fun setToken(context: Context, value: String) =
        sp(context).edit().putString(KEY_TOKEN, value).apply()

    fun getName(context: Context): String =
        sp(context).getString(KEY_NAME, "") ?: ""

    fun setName(context: Context, value: String) =
        sp(context).edit().putString(KEY_NAME, value).apply()

    fun isActive(context: Context): Boolean =
        sp(context).getBoolean(KEY_ACTIVE, false)

    fun setActive(context: Context, value: Boolean) =
        sp(context).edit().putBoolean(KEY_ACTIVE, value).apply()
}
