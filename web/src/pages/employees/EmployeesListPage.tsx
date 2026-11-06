import {
  ITAlert,
  ITButton,
  ITFlex,
  ITPage,
  ITText,
  ITStack } from "@axzydev/axzy_ui_system";
import { LuFileSpreadsheet, LuPlus, LuUserCheck, LuUserMinus, LuUsersRound } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import {
  EmployeesTable,
  useEmployeesList,
  type EmployeeStatusFilter,
} from "@features/user/employees-list";
import { useGoBack } from "@shared/lib/useGoBack";
import { TicState } from "@shared/ui/tic";

import { PanelCard } from "@shared/ui/panel-card";
import { AccountActionDialogs, AccountRowActions, useAccountActions } from "@features/user/account-actions";
import { UserEditDialog } from "@features/user/user-form";

const Waves = ({ color }: { color: string }) => (
  <svg aria-hidden viewBox="0 0 600 70" preserveAspectRatio="none" className="dash-waves pointer-events-none absolute inset-x-0 bottom-0 h-[52px] w-[200%]">
    <path d="M0,42 C90,14 150,62 240,40 C330,18 390,60 480,36 C540,24 570,30 600,42 L600,70 L0,70 Z" fill={color} />
    <path d="M0,52 C100,30 160,66 260,48 C360,28 420,62 520,44 C560,38 580,42 600,52 L600,70 L0,70 Z" fill={color} opacity="0.5" />
  </svg>
);

export default function EmployeesListPage() {
  const { t: tt } = useTranslation(["employees", "common", "users"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const canEditEmployees = useCan("hr.records");
  // El alta crea la cuenta (`POST /users`): la API exige `users.create`.
  const canCreateEmployees = useCan("users.create");

  const list = useEmployeesList();
  const account = useAccountActions(list.reload);
  // `/employees/:id/account` abre la cuenta (usuario, rol, correo) sobre la lista.
  const { id: accountId } = useParams<{ id: string }>();
  const canEditAccounts = useCan("users.edit");
  const openAccount = (u: { id: string }) => navigate(`/employees/${u.id}/account`);
  // Sin expediente (p. ej. SUPPORT) "ver" abre la cuenta.
  const view = (u: { id: string }) => (list.canRecords ? navigate(`/employees/${u.id}`) : openAccount(u));

  // Totales reales de `GET /hr/stats`, en el mosaico relleno del sistema.
  const stats = list.stats;
  const summary = stats
    ? [
        { id: "all", label: tt("summary.all"), value: stats.total, tone: "sea" as const, color: "var(--color-primary-600)" },
        { id: "active", label: tt("summary.active"), value: stats.active, tone: "mint" as const, color: "var(--color-success)" },
        { id: "inactive", label: tt("summary.inactive"), value: stats.inactive, tone: "sun" as const, color: "var(--color-warning)" },
      ]
    : [];

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={tt("title")}
      description={tt("description", { count: list.total })}
      backAction={() => goBack("/")}
      noPadding
      breadcrumbs={[
        { label: tt("common:nav.home"), onClick: () => navigate("/") },
        { label: tt("breadcrumb") },
      ]}
      actions={
        canCreateEmployees ? (
          <ITFlex gap={2}>
          <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => navigate("/employees/import")}>
            <ITFlex align="center" gap={1}>
              <LuFileSpreadsheet size={14} />
              <ITText className="font-bold text-[12px]">{tt("users:list.importExcel")}</ITText>
            </ITFlex>
          </ITButton>
          <ITButton
            variant="filled"
            color="primary"
            size="sm"
            className="tm-row-button"
            onClick={() => navigate("/employees/new")}
          >
            <ITFlex align="center" gap={1}>
              <LuPlus size={14} />
              <ITText className="font-bold text-[12px]">{tt("newEmployee")}</ITText>
            </ITFlex>
          </ITButton>
          </ITFlex>
        ) : undefined
      }
      icon={<LuUsersRound size={20} />}
    >
      {list.error && (
        <ITAlert variant="error" dismissible onDismiss={() => list.setError(null)}>
          {list.error}
        </ITAlert>
      )}

      <ITStack spacing={4}>
        {summary.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {summary.map((item) => {
              const selected = list.statusFilter === item.id;
              const icon = item.id === "all" ? <LuUsersRound size={14} /> : item.id === "active" ? <LuUserCheck size={14} /> : <LuUserMinus size={14} />;
              const wave = item.id === "all" ? "rgba(15,46,61,0.10)" : item.id === "active" ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.16)";
              const total = stats?.total ?? 0;
              const ratio = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => list.setStatusFilter(item.id as EmployeeStatusFilter)}
                  className={`dash-kpi dash-card relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition ${selected ? "ring-2 ring-emerald-300" : "hover:-translate-y-0.5 hover:shadow-md"}`}
                  style={{ borderColor: "#eef1f5" }}
                >
                  <Waves color={wave} />
                  <span className="relative flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${item.id === "inactive" ? "bg-amber-50 text-amber-700" : item.id === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{icon}</span>
                    {item.label}
                  </span>
                  <span className="relative mt-1 block text-[30px] font-black tabular-nums text-slate-900">{item.value}</span>
                  <span className="relative text-[11.5px] text-slate-500">{item.id === "all" ? "en la plantilla" : `${ratio}% del total`}</span>
                </button>
              );
            })}
          </div>
        )}

        {list.stats?.total === 0 ? (
          <PanelCard>
            <TicState
              kind="empty"
              title={tt("empty.title")}
              description={tt("empty.description")}
              action={
                canCreateEmployees ? (
                  <ITButton variant="filled" color="primary" onClick={() => navigate("/employees/new")}>
                    {tt("newEmployee")}
                  </ITButton>
                ) : undefined
              }
            />
          </PanelCard>
        ) : (
          <EmployeesTable
            departments={list.departments}
            canEdit={canEditEmployees && list.canRecords}
            fetchData={list.fetchTableData}
            reloadKey={list.reloadKey}
            externalFilters={list.externalFilters}
            onView={view}
            onEdit={(u) => navigate(`/employees/${u.id}/edit`)}
            onChanged={list.reload}
            rowActions={(u) => <AccountRowActions fx={account} person={u} onAccount={canEditAccounts ? openAccount : undefined} />}
          />
        )}
      </ITStack>

      <UserEditDialog userId={accountId ?? null} onClose={() => goBack("/employees")} onSaved={list.reload} />
      <AccountActionDialogs fx={account} />
    </ITPage>
  );
}
