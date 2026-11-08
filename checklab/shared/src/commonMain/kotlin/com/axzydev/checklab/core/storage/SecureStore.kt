package com.axzydev.checklab.core.storage

/**
 * Almacén cifrado de la sesión: Keystore en Android, Keychain en iOS.
 * Solo guarda cadenas; los objetos se serializan a JSON antes de entrar.
 */
interface SecureStore {
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun remove(key: String)
}

/** Implementación en memoria para pruebas. */
class InMemorySecureStore : SecureStore {
    private val values = mutableMapOf<String, String>()
    override fun get(key: String): String? = values[key]
    override fun put(key: String, value: String) {
        values[key] = value
    }
    override fun remove(key: String) {
        values.remove(key)
    }
}
