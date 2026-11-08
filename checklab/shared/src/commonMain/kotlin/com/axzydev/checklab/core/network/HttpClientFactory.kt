package com.axzydev.checklab.core.network

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.plugin
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json

val ApiJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

/** Rutas que no llevan token ni disparan el refresh. */
private val PUBLIC_PATHS = listOf("/auth/login", "/auth/branding", "/auth/refresh")

private fun HttpRequestBuilder.isPublic(): Boolean {
    val path = url.buildString().substringBefore('?')
    return PUBLIC_PATHS.any { path.endsWith(it) }
}

/**
 * Proveedor de tokens que conoce la sesión. `refresh()` devuelve el nuevo
 * token de acceso o `null` si la sesión ya no es válida.
 */
interface TokenProvider {
    fun accessToken(): String?
    suspend fun refresh(): String?
    suspend fun onSessionExpired()
}

/**
 * Cliente HTTP del API: base URL, JSON, token Bearer y un reintento tras
 * refrescar el token cuando el servidor responde 401.
 */
fun createHttpClient(baseUrl: String, tokens: TokenProvider, engine: HttpClientEngine? = null): HttpClient {
    val config: io.ktor.client.HttpClientConfig<*>.() -> Unit = {
        expectSuccess = false
        install(ContentNegotiation) { json(ApiJson) }
        defaultRequest {
            url(baseUrl.trimEnd('/') + "/")
            contentType(ContentType.Application.Json)
        }
    }
    val client = if (engine != null) HttpClient(engine, config) else HttpClient(config)
    client.plugin(HttpSend).intercept { request ->
        if (request.isPublic()) return@intercept execute(request)
        tokens.accessToken()?.let { request.header(HttpHeaders.Authorization, "Bearer $it") }
        val call = execute(request)
        if (call.response.status.value != 401) return@intercept call
        val fresh = tokens.refresh()
        if (fresh == null) {
            tokens.onSessionExpired()
            return@intercept call
        }
        request.headers.remove(HttpHeaders.Authorization)
        request.header(HttpHeaders.Authorization, "Bearer $fresh")
        val retried = execute(request)
        if (retried.response.status.value == 401) tokens.onSessionExpired()
        retried
    }
    return client
}

/** Convierte una respuesta fallida en [ApiException] con el código del API. */
suspend fun HttpResponse.throwIfError(): HttpResponse {
    if (status.isSuccess()) return this
    val body = runCatching { ApiJson.decodeFromString<ApiErrorBody>(bodyAsText()) }.getOrNull()
    throw ApiException(
        status = status.value,
        code = body?.code ?: "HTTP_${status.value}",
        message = body?.message ?: "El servidor respondió ${status.value}.",
    )
}

/** Ejecuta una llamada y traduce fallas de red a [ApiException] (`status = 0`). */
suspend inline fun <reified T> apiCall(block: () -> HttpResponse): T {
    val response = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: ApiException) {
        throw e
    } catch (e: Exception) {
        throw ApiException(0, ApiException.NETWORK, "No hay conexión con el servidor.")
    }
    response.throwIfError()
    return response.body()
}

/** Igual que [apiCall] para respuestas sin cuerpo (204). */
suspend inline fun apiCallUnit(block: () -> HttpResponse) {
    val response = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ApiException(0, ApiException.NETWORK, "No hay conexión con el servidor.")
    }
    response.throwIfError()
}
