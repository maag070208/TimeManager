package com.axzydev.checklab.testing

import com.axzydev.checklab.core.network.TokenProvider
import com.axzydev.checklab.core.network.createHttpClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

const val API_BASE = "http://api.test/api/v1"

private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")

fun MockRequestHandleScope.ok(body: String): HttpResponseData = respond(body, HttpStatusCode.OK, jsonHeaders)

fun MockRequestHandleScope.fail(status: Int, code: String, message: String): HttpResponseData =
    respond("""{"error":"HttpError","code":"$code","message":"$message"}""", HttpStatusCode.fromValue(status), jsonHeaders)

fun HttpRequestData.bodyText(): String = (body as? OutgoingContent.ByteArrayContent)?.bytes()?.decodeToString().orEmpty()

fun HttpRequestData.bodyJson(): JsonObject = Json.parseToJsonElement(bodyText()).jsonObject

/** Ruta relativa a la base del API, sin query: `time-clock/summary`. */
val HttpRequestData.route: String get() = url.encodedPath.removePrefix("/api/v1/")

/**
 * Cliente del API con un servidor falso: cada petición queda en [requests] y
 * la responde [handler]. El token es fijo; no se prueba aquí el refresh.
 */
class MockApi(private val handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) {
    val requests = mutableListOf<HttpRequestData>()

    val client: HttpClient = createHttpClient(
        API_BASE,
        object : TokenProvider {
            override fun accessToken() = "TOKEN"
            override suspend fun refresh(): String? = null
            override suspend fun onSessionExpired() {}
        },
        MockEngine { request ->
            requests += request
            handler(request)
        },
    )

    val last: HttpRequestData get() = requests.last()
}
