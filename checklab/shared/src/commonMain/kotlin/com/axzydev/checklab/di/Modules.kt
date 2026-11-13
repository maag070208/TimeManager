package com.axzydev.checklab.di

import com.axzydev.checklab.approvals.ApprovalsApi
import com.axzydev.checklab.approvals.LeaveApprovalViewModel
import com.axzydev.checklab.approvals.NotificationsViewModel
import com.axzydev.checklab.approvals.OvertimeApprovalViewModel
import com.axzydev.checklab.auth.ChangePasswordViewModel
import com.axzydev.checklab.auth.ProfileViewModel
import com.axzydev.checklab.payroll.ClosuresViewModel
import com.axzydev.checklab.payroll.PayrollApi
import com.axzydev.checklab.payroll.PayrollViewModel
import com.axzydev.checklab.payroll.PositionsViewModel
import com.axzydev.checklab.people.ActasViewModel
import com.axzydev.checklab.people.DepartmentsViewModel
import com.axzydev.checklab.people.EmployeeViewModel
import com.axzydev.checklab.people.PeopleApi
import com.axzydev.checklab.people.PeopleViewModel
import com.axzydev.checklab.people.RecordsViewModel
import com.axzydev.checklab.schedules.AssignViewModel
import com.axzydev.checklab.schedules.SchedulesApi
import com.axzydev.checklab.schedules.SchedulesViewModel
import com.axzydev.checklab.auth.LoginViewModel
import com.axzydev.checklab.auth.SessionRepository
import com.axzydev.checklab.core.network.createHttpClient
import com.axzydev.checklab.home.DashboardApi
import com.axzydev.checklab.home.HomeViewModel
import com.axzydev.checklab.nom.MyWorkdayViewModel
import com.axzydev.checklab.nom.NomApi
import com.axzydev.checklab.nom.WorkerApi
import com.axzydev.checklab.nom.WorkerPortalViewModel
import org.koin.core.context.startKoin
import org.koin.core.module.Module
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module

/** Módulos comunes. `platform` aporta el [com.axzydev.checklab.core.storage.SecureStore] nativo. */
fun appModules(apiUrl: String, platform: Module): List<Module> = listOf(
    platform,
    module {
        single { SessionRepository(get(), apiUrl) { tokens -> createHttpClient(apiUrl, tokens) } }
        single { get<SessionRepository>().client }
        single { DashboardApi(get()) }
        single { NomApi(get()) }
        single { WorkerApi(get()) }
        single { ApprovalsApi(get()) }
        single { com.axzydev.checklab.approvals.UnreadCounter(get()) }
        single { PeopleApi(get()) }
        single { SchedulesApi(get()) }
        single { PayrollApi(get()) }
        single { com.axzydev.checklab.clocks.ClocksApi(get()) }
        single { com.axzydev.checklab.clocks.AttendanceApi(get()) }
        single { com.axzydev.checklab.settings.SettingsApi(get()) }
        viewModel { LoginViewModel(get()) }
        viewModel { ChangePasswordViewModel(get()) }
        viewModel { HomeViewModel(get()) }
        viewModel { MyWorkdayViewModel(get(), get(), get()) }
        viewModel { WorkerPortalViewModel(get(), get<SessionRepository>()::today) }
        viewModel { NotificationsViewModel(get(), get()) }
        viewModel { OvertimeApprovalViewModel(get(), get<SessionRepository>()::today) }
        viewModel { LeaveApprovalViewModel(get()) }
        viewModel { ProfileViewModel(get()) }
        viewModel { PeopleViewModel(get()) }
        viewModel { EmployeeViewModel(get()) }
        viewModel { RecordsViewModel(get()) }
        viewModel { DepartmentsViewModel(get()) }
        viewModel { ActasViewModel(get()) }
        viewModel { SchedulesViewModel(get()) }
        viewModel { AssignViewModel(get(), get()) }
        viewModel { PayrollViewModel(get(), get<SessionRepository>()::today) }
        viewModel { ClosuresViewModel(get()) }
        viewModel { PositionsViewModel(get()) }
        viewModel { com.axzydev.checklab.clocks.ClocksViewModel(get()) }
        viewModel { com.axzydev.checklab.clocks.AttendanceViewModel(get(), get<SessionRepository>()::today) }
        viewModel { com.axzydev.checklab.settings.ConfigViewModel(get()) }
        viewModel { com.axzydev.checklab.settings.AgreementsViewModel(get(), get(), get()) }
        viewModel { com.axzydev.checklab.settings.TeleworkAdminViewModel(get()) }
        viewModel { com.axzydev.checklab.settings.RolesViewModel(get()) }
        viewModel { com.axzydev.checklab.settings.AuditViewModel(get()) }
    },
)

fun initKoin(apiUrl: String, platform: Module, extra: KoinAppDeclaration = {}) {
    startKoin {
        extra()
        modules(appModules(apiUrl, platform))
    }
}
