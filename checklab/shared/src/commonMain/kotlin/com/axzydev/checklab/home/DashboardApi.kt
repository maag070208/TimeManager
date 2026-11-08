package com.axzydev.checklab.home

import com.axzydev.checklab.core.network.apiCall
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import kotlinx.serialization.Serializable

/** Widgets del inicio del cliente (`api/src/modules/dashboard`), los mismos que usa la web. */
class DashboardApi(private val client: HttpClient) {
    suspend fun attendanceToday(): AttendanceToday = apiCall { client.get("dashboard/attendance-today") }
    suspend fun people(): PeopleWidget = apiCall { client.get("dashboard/people") }
    suspend fun hrRecords(): HrRecordsWidget = apiCall { client.get("dashboard/hr-records") }
    suspend fun overtimeWeek(): OvertimeWeek = apiCall { client.get("dashboard/overtime-week") }
}

@Serializable
data class AttendanceToday(
    val date: String,
    val timezone: String,
    val scope: String,
    val counts: AttendanceCounts,
    val rows: List<AttendanceRow> = emptyList(),
)

@Serializable
data class AttendanceCounts(
    val PRESENT: Int = 0,
    val LATE: Int = 0,
    val NOT_ARRIVED: Int = 0,
    val NOT_YET: Int = 0,
    val REST: Int = 0,
    val onSite: Int = 0,
    val people: Int = 0,
)

@Serializable
data class AttendanceRow(
    val userId: String,
    val name: String,
    val departmentName: String? = null,
    val status: String,
    val onSite: Boolean = false,
    val entryAt: String? = null,
    val exitAt: String? = null,
    val lateMin: Int = 0,
    val shift: String? = null,
)

@Serializable
data class PeopleWidget(
    val active: Int,
    val hiresThisMonth: Int = 0,
    val departuresThisMonth: Int = 0,
)

@Serializable
data class HrRecordsWidget(val summary: HrRecordsSummary)

@Serializable
data class HrRecordsSummary(
    val employees: Int,
    val complete: Int,
    val missingRequired: Int = 0,
)

@Serializable
data class OvertimeWeek(
    val extraMin: Int = 0,
    val approvedExtraMin: Int = 0,
    val pendingExtraMin: Int = 0,
    val topPending: List<OvertimePending> = emptyList(),
)

@Serializable
data class OvertimePending(val userId: String, val name: String, val pendingExtraMin: Int)

/**
 * Lectura del día sin ambigüedad. `scheduled` es a quien le toca trabajar hoy
 * (igual que el inicio web); `arrived` cuenta a tiempo + con retardo; `onSite`
 * es quien sigue adentro ahorita, así que `finished` es quien llegó y ya salió.
 */
data class AttendanceSummary(
    val scheduled: Int,
    val arrived: Int,
    val onTime: Int,
    val late: Int,
    val missing: Int,
    val onSite: Int,
    val finished: Int,
) {
    val progress: Float get() = if (scheduled == 0) 0f else (arrived.toFloat() / scheduled).coerceIn(0f, 1f)
}

fun AttendanceToday.summary(): AttendanceSummary {
    val arrived = counts.PRESENT + counts.LATE
    return AttendanceSummary(
        scheduled = arrived + counts.NOT_ARRIVED,
        arrived = arrived,
        onTime = counts.PRESENT,
        late = counts.LATE,
        missing = counts.NOT_ARRIVED,
        onSite = counts.onSite,
        finished = (arrived - counts.onSite).coerceAtLeast(0),
    )
}
