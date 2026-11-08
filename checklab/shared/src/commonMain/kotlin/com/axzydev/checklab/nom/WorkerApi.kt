package com.axzydev.checklab.nom

import com.axzydev.checklab.core.network.apiCall
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.Serializable
import com.axzydev.checklab.core.network.ApiJson
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// ── Teletrabajo (NOM-037) ─────────────────────────────────────────────────

@Serializable
data class TeleworkRegistration(
    val id: String,
    val mode: String,
    val status: String,
    val homeAddress: String? = null,
    val startedAt: String? = null,
    val consentAcceptedAt: String? = null,
)

@Serializable
data class TeleworkPolicy(
    val teleworkPolicy: String? = null,
    val disconnectPolicy: String? = null,
    val privacyNotice: String? = null,
    val policyVersion: Int = 1,
    val privacyNoticeVersion: Int = 1,
)

@Serializable
data class ChecklistTemplate(val version: Int = 1, val items: List<String> = emptyList())

@Serializable
data class LastChecklist(val kind: String, val completedAt: String? = null)

@Serializable
data class MeTelework(
    val registration: TeleworkRegistration? = null,
    val policy: TeleworkPolicy = TeleworkPolicy(),
    val checklistTemplate: ChecklistTemplate = ChecklistTemplate(),
    val lastChecklist: LastChecklist? = null,
    val nextPeriodicDueAt: String? = null,
    val consentCurrent: Boolean = false,
    val pendingConsent: Boolean = false,
)

@Serializable
data class TeleworkAccept(val policyVersion: Int, val privacyNoticeVersion: Int)

@Serializable
data class ChecklistSubmit(val kind: String, val answers: Map<String, String>)

// ── Registro de jornada ───────────────────────────────────────────────────

@Serializable
data class RecordAgreement(
    val id: String,
    val methods: List<String> = emptyList(),
    val roundingPolicy: String? = null,
    val correctionRules: String? = null,
    val acceptedAt: String? = null,
    val employerAcceptedAt: String? = null,
)

@Serializable
data class RecordProposal(
    val methods: List<String> = emptyList(),
    val text: String = "",
    val roundingPolicy: String? = null,
    val correctionRules: String? = null,
)

@Serializable
data class AcceptAgreement(val methods: List<String>, val roundingPolicy: String?, val correctionRules: String?)

@Serializable
data class AckTotals(val ordinaryMin: Int = 0, val otDoubleMin: Int = 0, val otTripleMin: Int = 0, val otIllegalMin: Int = 0)

@Serializable
data class AckSummary(val totals: AckTotals = AckTotals())

@Serializable
data class RecordAcknowledgment(
    val id: String,
    val periodStart: String,
    val periodEnd: String,
    val status: String,
    val summary: AckSummary = AckSummary(),
    val acceptedAt: String? = null,
)

@Serializable
data class AcknowledgeRequest(val periodStart: String, val periodEnd: String, val accept: Boolean, val note: String? = null)

@Serializable
data class OvertimeRequestRow(
    val id: String,
    val reason: String,
    val plannedMin: Int,
    val days: List<String> = emptyList(),
    val status: String,
    val workerNote: String? = null,
)

@Serializable
data class OvertimeDecision(val accept: Boolean, val note: String? = null)

// ── Vacaciones y permisos ─────────────────────────────────────────────────

@Serializable
data class LeaveType(val id: String, val key: String, val name: String, val kind: String, val paid: Boolean = true, val active: Boolean = true)

@Serializable
data class LeaveBalance(val year: Int = 0, val entitlementDays: Int = 0, val usedDays: Int = 0, val pendingDays: Int = 0, val availableDays: Int = 0)

@Serializable
data class LeaveUser(val name: String, val employeeNumber: String? = null)

@Serializable
data class LeaveRequestRow(
    val id: String,
    val type: LeaveType,
    val startDate: String,
    val endDate: String,
    val days: Int = 0,
    val status: String,
    val reason: String? = null,
    val decisionNote: String? = null,
    val user: LeaveUser? = null,
)

@Serializable
data class CreateLeave(val typeId: String, val startDate: String, val endDate: String, val reason: String? = null)

@Serializable
data class DecideLeave(val approve: Boolean, val note: String? = null)

/** Endpoints `nom/me` del portal del trabajador (los mismos que usa Mi jornada en la web). */
class WorkerApi(private val client: HttpClient) {
    suspend fun telework(): MeTelework = apiCall { client.get("nom/me/telework") }
    suspend fun acceptTelework(policy: TeleworkPolicy): JsonObject =
        apiCall { client.post("nom/me/telework/accept") { setBody(TeleworkAccept(policy.policyVersion, policy.privacyNoticeVersion)) } }
    suspend fun submitChecklist(kind: String, answers: Map<String, String>): JsonObject =
        apiCall { client.post("nom/me/telework/checklist") { setBody(ChecklistSubmit(kind, answers)) } }

    /** `null` mientras la persona no ha firmado el acuerdo (el API responde `null`). */
    suspend fun recordAgreement(): RecordAgreement? {
        val raw: JsonElement = apiCall { client.get("nom/me/record-agreement") }
        return (raw as? JsonObject)?.let { ApiJson.decodeFromJsonElement(RecordAgreement.serializer(), it) }
    }
    suspend fun recordProposal(): RecordProposal = apiCall { client.get("nom/me/record-agreement/proposal") }
    suspend fun acceptRecordAgreement(p: RecordProposal): RecordAgreement =
        apiCall { client.post("nom/me/record-agreement/accept") { setBody(AcceptAgreement(p.methods, p.roundingPolicy, p.correctionRules)) } }
    suspend fun acknowledgments(): List<RecordAcknowledgment> = apiCall { client.get("nom/me/record-acknowledgments") }
    suspend fun acknowledge(request: AcknowledgeRequest): JsonObject =
        apiCall { client.post("nom/me/record-acknowledgments") { setBody(request) } }
    suspend fun overtimeRequests(): List<OvertimeRequestRow> = apiCall { client.get("nom/me/overtime-requests") }
    suspend fun decideOvertime(id: String, accept: Boolean): OvertimeRequestRow =
        apiCall { client.post("nom/me/overtime-requests/$id/decision") { setBody(OvertimeDecision(accept)) } }

    suspend fun leaveBalance(year: Int): LeaveBalance = apiCall { client.get("nom/me/leave/balance") { parameter("year", year) } }
    suspend fun leaveTypes(): List<LeaveType> = apiCall { client.get("nom/leave/types") }
    suspend fun myLeave(): List<LeaveRequestRow> = apiCall { client.get("nom/me/leave/requests") }
    suspend fun requestLeave(request: CreateLeave): LeaveRequestRow = apiCall { client.post("nom/me/leave/requests") { setBody(request) } }
    suspend fun cancelLeave(id: String): LeaveRequestRow = apiCall { client.post("nom/me/leave/requests/$id/cancel") { setBody(JsonObject(emptyMap())) } }
}

val CHECKLIST_LABELS = mapOf(
    "space_adequate" to "El espacio de trabajo es adecuado y exclusivo",
    "ergonomics" to "Silla, mesa y pantalla en condiciones ergonómicas",
    "electrical_safety" to "Instalación eléctrica segura y sin riesgos",
    "connectivity" to "Cuenta con conexión a internet estable",
    "ventilation_lighting" to "Ventilación e iluminación suficientes",
    "emergency_plan" to "Conoce el plan de emergencia y contactos",
    "equipment_inventory" to "El equipo asignado está inventariado y en buen estado",
    "no_risk_conditions" to "No hay condiciones de riesgo en el lugar",
)

val METHOD_LABELS = mapOf("CLOCK" to "Reloj checador", "REMOTE" to "Checada en app", "ACCESS" to "Control de acceso")

val LEAVE_STATUS = mapOf("PENDING" to "Pendiente", "APPROVED" to "Aprobada", "REJECTED" to "Rechazada", "CANCELLED" to "Cancelada")
