package com.axzydev.checklab.navigation

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import com.axzydev.checklab.approvals.LeaveApprovalContent
import com.axzydev.checklab.approvals.NotificationsContent
import com.axzydev.checklab.approvals.OvertimeApprovalContent
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.clocks.AttendanceContent
import com.axzydev.checklab.clocks.ClocksContent
import com.axzydev.checklab.settings.AgreementsContent
import com.axzydev.checklab.settings.AuditContent
import com.axzydev.checklab.settings.ConfigContent
import com.axzydev.checklab.settings.RolesContent
import com.axzydev.checklab.settings.TeleworkAdminContent
import com.axzydev.checklab.auth.ProfileContent
import com.axzydev.checklab.nom.MyWorkdayTabs
import com.axzydev.checklab.payroll.PayrollContent
import com.axzydev.checklab.payroll.PositionsContent
import com.axzydev.checklab.people.ActasContent
import com.axzydev.checklab.people.DepartmentsContent
import com.axzydev.checklab.people.PeopleContent
import com.axzydev.checklab.people.RecordsContent
import com.axzydev.checklab.schedules.AssignContent
import com.axzydev.checklab.schedules.SchedulesContent

/** Pantalla de cada sección del menú; lo que aún no llega muestra en qué fase llega. */
@Composable
fun ColumnScope.SectionContent(id: String, me: Me) {
    when (id) {
        MY_WORKDAY -> MyWorkdayTabs(me)
        "notifications" -> NotificationsContent()
        "profile" -> ProfileContent(me)
        "overtime" -> OvertimeApprovalContent(me)
        "leave" -> LeaveApprovalContent(me)
        "employees" -> PeopleContent(me)
        "employeeRecords" -> RecordsContent()
        "departments" -> DepartmentsContent()
        "hrReports" -> ActasContent()
        "schedules" -> SchedulesContent(me)
        "schedulesAssign" -> AssignContent(me)
        "payroll" -> PayrollContent(me)
        "payrollSettings" -> PositionsContent(me)
        "clockDashboard" -> ClocksContent(me)
        "attendance" -> AttendanceContent()
        "generalSettings" -> ConfigContent(me)
        "workdayAgreements" -> AgreementsContent(me)
        "telework" -> TeleworkAdminContent()
        "roles" -> RolesContent()
        "audit" -> AuditContent(me)
        else -> Unit
    }
}
