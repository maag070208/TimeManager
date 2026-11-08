package com.axzydev.checklab.approvals

import com.axzydev.checklab.testing.MockApi
import com.axzydev.checklab.testing.fail
import com.axzydev.checklab.testing.ok
import com.axzydev.checklab.testing.route
import io.ktor.http.HttpMethod
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

private const val NOTIFICATIONS = """{"data":[
{"id":"n1","userId":"u","type":"ROSTER","title":"Baja pendiente en el reloj","detail":"…","read":false,"createdAt":"2026-11-08T10:00:00.000Z"},
{"id":"n2","userId":"u","type":"WORKDAY","title":"Jornada por encima del tope","detail":null,"read":true,"createdAt":"2026-11-07T10:00:00.000Z"}],"total":2}"""

class NotificationsCountTest {
    @Test
    fun elPluralNoLlevaTilde() {
        assertEquals("1 notificación", notificationsCount(1))
        assertEquals("3 notificaciones", notificationsCount(3))
        assertEquals("0 notificaciones", notificationsCount(0))
    }
}

class UnreadCounterTest {
    @Test
    fun elContadorLeeElNumeroDelApi() = runTest {
        val api = MockApi { ok("""{"count":2}""") }
        val counter = UnreadCounter(ApprovalsApi(api.client))
        counter.refresh()
        assertEquals("notifications/unread-count", api.last.route)
        assertEquals(2, counter.count.value)
    }

    @Test
    fun siLaConsultaFallaSeQuedaElUltimoValor() = runTest {
        var fails = false
        val counter = UnreadCounter(ApprovalsApi(MockApi { if (fails) fail(500, "INTERNAL", "x") else ok("""{"count":5}""") }.client))
        counter.refresh()
        fails = true
        counter.refresh()
        assertEquals(5, counter.count.value)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationsViewModelTest {
    @BeforeTest fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun marcarTodasComoLeidasBajaElContadorDeLaBarra() = runTest {
        var unread = 1
        val api = MockApi { request ->
            when (request.route) {
                "notifications/read-all" -> { unread = 0; ok("{}") }
                "notifications/unread-count" -> ok("""{"count":$unread}""")
                else -> ok(NOTIFICATIONS)
            }
        }
        val counter = UnreadCounter(ApprovalsApi(api.client))
        counter.refresh()
        assertEquals(1, counter.count.value)

        NotificationsViewModel(ApprovalsApi(api.client), counter).readAll()
        withContext(Dispatchers.Default) { withTimeout(5_000) { while (counter.count.value != 0) delay(10) } }
        assertEquals(0, counter.count.value)
        assertEquals(HttpMethod.Post, api.requests.first { it.route == "notifications/read-all" }.method)
    }
}
