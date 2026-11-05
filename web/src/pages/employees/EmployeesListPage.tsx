import {
  ITAlert,
  ITBentoStatStrip,
  ITButton,
  ITFlex,
  ITPage,
  ITText, ITStack } from "@axzydev/axzy_ui_system";
import { LuPlus, LuUsersRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import {
  EmployeesTable,
  useEmployeesList,
  type EmployeeStatusFilter,
} from "@features/user/employees-list";
import { useGoBack } from "@shared/lib/useGoBack";
import { LangostinState } from "@shared/ui/langostin";

import { PanelCard } from "@shared/ui/panel-card";

export default function EmployeesListPage() {
  const { t: tt } = useTranslation(["employees", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const canEditEmployees = useCan("hr.records");
  // El alta crea la cuenta (`POST /users`): la API exige `users.create`.
  const canCreateEmployees = useCan("users.create");

  const list = useEmployeesList();

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
          <ITButton
            variant="filled"
            color="primary"
            onClick={() => navigate("/users/new")}
          >
            <ITFlex align="center" gap={1}>
              <LuPlus size={14} />
              <ITText className="font-bold text-[12px]">{tt("newEmployee")}</ITText>
            </ITFlex>
          </ITButton>
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
          <ITBentoStatStrip
            items={summary}
            activeId={list.statusFilter}
            onSelect={(id) => list.setStatusFilter(id as EmployeeStatusFilter)}
          />
        )}

        {list.stats?.total === 0 ? (
          <PanelCard>
            <LangostinState
              kind="empty"
              title={tt("empty.title")}
              description={tt("empty.description")}
              action={
                canCreateEmployees ? (
                  <ITButton variant="filled" color="primary" onClick={() => navigate("/users/new")}>
                    {tt("newEmployee")}
                  </ITButton>
                ) : undefined
              }
            />
          </PanelCard>
        ) : (
          <EmployeesTable
            departments={list.departments}
            canEdit={canEditEmployees}
            fetchData={list.fetchTableData}
            reloadKey={list.reloadKey}
            externalFilters={list.externalFilters}
            onView={(u) => navigate(`/employees/${u.id}`)}
            onEdit={(u) => navigate(`/employees/${u.id}/edit`)}
            onChanged={list.reload}
          />
        )}
      </ITStack>
    </ITPage>
  );
}
