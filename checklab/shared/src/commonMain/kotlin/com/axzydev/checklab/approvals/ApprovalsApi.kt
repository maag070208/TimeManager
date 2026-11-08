package com.axzydev.checklab.approvals

import com.axzydev.checklab.core.network.apiCall
import com.axzydev.checklab.core.network.apiCallUnit
import com.axzydev.checklab.nom.DecideLeave
import com.axzydev.checklab.nom.LeaveRequestRow
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// ── Notificaciones ────────────────────────────────────────────────────────

@Serializable
data class Notification(
    val id: String,
    val type: String,
    val title: String,
    val detail: String? = null,
    val read: Boolean = false,
    val createdAt: String,
)

@Serializable
data class NotificationPage(val data: List<Notification> = emptyList(), val total: Int = 0)

@Serializable
data class UnreadCount(val count: Int = 0)

// ── Tiempo extra por día (`/overtime`) ────────────────────────────────────

@Serializable
data class OvertimeDay(
    val userId: String,
    val employeeName: String,
    val employeeNumber: String? = null,
    val departmentName: String? = null,
    val date: String,
    val extraMin: Int = 0,
    val workedMin: Int = 0,
    val scheduledMin: Int = 0,
    val shift: String? = null,
    val restDay: Boolean = false,
    val status: String,
    val note: String? = null,
    val decidedByName: String? = null,
)

@Serializable
data class OvertimeSummary(
    val pendingDays: Int = 0,
    val approvedDays: Int = 0,
    val rejectedDays: Int = 0,
    val pendingMinutes: Int = 0,
    val approvedMinutes: Int = 0,
    val rejectedMinutes: Int = 0,
    val peopleWithPending: Int = 0,
)

@Serializable
data class OvertimePage(val data: List<OvertimeDay> = emptyList(), val total: Int = 0, val summary: OvertimeSummary = OvertimeSummary())

@Serializable
data class OvertimeQuery(val page: Int, val limit: Int, val filters: Map<String, JsonPrimitive>)

@Serializable
data class OvertimeItem(val userId: String, val date: String)

@Serializable
data class OvertimeDecide(val filters: Map<String, JsonPrimitive>, val items: List<OvertimeItem>, val status: String, val note: String? = null)

@Serializable
data class OvertimeDecideResult(val updated: Int = 0, val skipped: Int = 0)

class ApprovalsApi(private val client: HttpClient) {
    suspend fun notifications(unreadOnly: Boolean = false): NotificationPage =
        apiCall { client.get("notifications") { if (unreadOnly) parameter("unread", "true") } }
    suspend fun unreadCount(): Int = apiCall<UnreadCount> { client.get("notifications/unread-count") }.count
    suspend fun markRead(id: String) = apiCallUnit { client.post("notifications/$id/read") { setBody(JsonObject(emptyMap())) } }
    suspend fun markAllRead() = apiCallUnit { client.post("notifications/read-all") { setBody(JsonObject(emptyMap())) } }
    suspend fun deleteNotification(id: String) = apiCallUnit { client.delete("notifications/$id") }

    /** Días de tiempo extra de la semana que contiene `date`, filtrados por estado. */
    suspend fun overtime(date: String, status: String, page: Int = 1): OvertimePage =
        apiCall { client.post("overtime/query") { setBody(OvertimeQuery(page, 100, filters(date) + ("status" to JsonPrimitive(status)))) } }

    suspend fun decideOvertime(date: String, items: List<OvertimeItem>, approve: Boolean, note: String?): OvertimeDecideResult =
        apiCall {
            client.post("overtime/approvals") {
                setBody(OvertimeDecide(filters(date), items, if (approve) "APPROVED" else "REJECTED", note?.takeIf { it.isNotBlank() }))
            }
        }

    suspend fun leaveRequests(status: String?): List<LeaveRequestRow> =
        apiCall { client.get("nom/leave/requests") { status?.let { parameter("status", it) } } }

    suspend fun decideLeave(id: String, approve: Boolean, note: String?): LeaveRequestRow =
        apiCall { client.post("nom/leave/requests/$id/decide") { setBody(DecideLeave(approve, note?.takeIf { it.isNotBlank() })) } }

    private fun filters(date: String) = mapOf("period" to JsonPrimitive("WEEK"), "date" to JsonPrimitive(date))
}
