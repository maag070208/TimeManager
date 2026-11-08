package com.axzydev.checklab.people

import com.axzydev.checklab.core.network.apiCall
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class Named(val id: String, val name: String)

@Serializable
data class Person(
    val id: String,
    val username: String,
    val name: String,
    val email: String? = null,
    val role: String = "",
    val active: Boolean = true,
    val jobTitle: String? = null,
    val employeeNumber: String? = null,
    val department: Named? = null,
    val subarea: Named? = null,
    val deactivationReason: String? = null,
)

@Serializable
data class Page<T>(val data: List<T> = emptyList(), val total: Int = 0)

@Serializable
data class TableQuery(val page: Int, val limit: Int, val filters: Map<String, JsonPrimitive> = emptyMap())

@Serializable
data class OverviewEmployee(val id: String, val name: String, val employeeNumber: String? = null, val jobTitle: String? = null, val department: String? = null, val active: Boolean = true)

@Serializable
data class OverviewSummary(val documents: Int = 0, val missingRequiredDocuments: Int = 0, val punchesLast30Days: Int = 0, val disciplinaryReportsLastYear: Int = 0)

@Serializable
data class OverviewSchedule(val id: String, val name: String, val validFrom: String? = null)

@Serializable
data class OverviewDocument(val id: String, val name: String, val type: String? = null, val uploadedAt: String? = null)

@Serializable
data class EmployeeOverview(
    val employee: OverviewEmployee,
    val summary: OverviewSummary = OverviewSummary(),
    val schedule: OverviewSchedule? = null,
    val documents: List<OverviewDocument> = emptyList(),
)

@Serializable
data class DeactivateBody(val reason: String, val notifyUser: Boolean = false)

@Serializable
data class CreatePerson(
    val username: String,
    val password: String,
    val name: String,
    val email: String? = null,
    val jobTitle: String? = null,
    val employeeNumber: String? = null,
    val departmentId: String? = null,
    val role: String? = null,
)

@Serializable
data class Department(
    val id: String,
    val name: String,
    val active: Boolean = true,
    val subareas: List<Named> = emptyList(),
    @kotlinx.serialization.SerialName("_count") val count: DepartmentCount? = null,
)

@Serializable
data class DepartmentCount(val users: Int = 0)

@Serializable
data class ActaUser(val id: String, val name: String, val employeeNumber: String? = null, val department: Named? = null)

@Serializable
data class Acta(
    val id: String,
    val reason: String,
    val incidentDate: String,
    val description: String? = null,
    val sanction: String? = null,
    val user: ActaUser? = null,
    val createdBy: Named? = null,
)

@Serializable
data class RecordRow(
    val userId: String,
    val name: String,
    val employeeNumber: String? = null,
    val departmentName: String? = null,
    val missingRequired: List<Named> = emptyList(),
    val missingDocuments: List<Named> = emptyList(),
)

@Serializable
data class RecordsSummary(val employees: Int = 0, val complete: Int = 0, val missingRequired: Int = 0, val missingDocuments: Int = 0)

@Serializable
data class RecordsWidget(val summary: RecordsSummary = RecordsSummary(), val rows: List<RecordRow> = emptyList())

class PeopleApi(private val client: HttpClient) {
    suspend fun people(name: String, active: Boolean?, page: Int = 1): Page<Person> {
        val filters = buildMap {
            if (name.isNotBlank()) put("name", JsonPrimitive(name.trim()))
            if (active != null) put("active", JsonPrimitive(active))
        }
        return apiCall { client.post("users/query") { setBody(TableQuery(page, 50, filters)) } }
    }

    suspend fun overview(id: String): EmployeeOverview = apiCall { client.get("hr/$id/overview") }
    suspend fun deactivate(id: String, reason: String): JsonObject = apiCall { client.patch("users/$id/deactivate") { setBody(DeactivateBody(reason)) } }
    suspend fun reactivate(id: String): JsonObject = apiCall { client.patch("users/$id/reactivate") { setBody(JsonObject(emptyMap())) } }
    suspend fun create(person: CreatePerson): JsonObject = apiCall { client.post("users") { setBody(person) } }

    suspend fun departments(): List<Department> = apiCall { client.get("departments") }
    suspend fun actas(q: String): Page<Acta> {
        val filters = if (q.isBlank()) emptyMap() else mapOf("q" to JsonPrimitive(q.trim()))
        return apiCall { client.post("hr/disciplinary-reports/query") { setBody(TableQuery(1, 50, filters)) } }
    }

    suspend fun records(): RecordsWidget = apiCall { client.get("dashboard/hr-records") }
}

val ACTA_REASONS = mapOf(
    "ABSENCE" to "Inasistencia",
    "TARDINESS" to "Retardo",
    "INTOXICATION" to "Estado de ebriedad",
    "MISCONDUCT" to "Conducta inapropiada",
    "NONCOMPLIANCE" to "Incumplimiento de funciones",
    "OTHER" to "Otro",
)
