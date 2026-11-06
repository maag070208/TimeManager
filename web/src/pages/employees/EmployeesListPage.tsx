import {
  ITAlert,
  ITButton,
  ITFlex,
  ITText,
  ITStack } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
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
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { AccountActionDialogs, AccountRowActions, useAccountActions } from "@features/user/account-actions";
import { UserEditDialog } from "@features/user/user-form";

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
          <BentoFilterCards
            activeId={list.statusFilter}
            onSelect={(id) => list.setStatusFilter(id as EmployeeStatusFilter)}
            items={summary.map((item) => ({
              id: item.id,
              label: item.label,
              value: item.value,
              caption: item.id === "all" ? "en la plantilla" : `${stats?.total ? Math.round((item.value / stats.total) * 100) : 0}% del total`,
              icon: item.id === "all" ? <LuUsersRound size={14} /> : item.id === "active" ? <LuUserCheck size={14} /> : <LuUserMinus size={14} />,
            }))}
          />
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
