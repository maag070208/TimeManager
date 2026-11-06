import { useMemo } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITCheckbox,
  ITDataTable,
  ITDialog,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  ITTextarea,
  ITToast } from "@axzydev/axzy_ui_system";
import type { Column } from "@axzydev/axzy_ui_system";
import { FaCheck, FaTimes } from "react-icons/fa";
import type { OvertimeDayRow } from "@entities/overtime";
import { punchTime, workedTime } from "@entities/schedule";
import { dateLocale } from "@shared/i18n";
import { PeriodPicker } from "@shared/ui/period-picker";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { dayKeyOf, type StatusTab, type UseOvertimeApproval } from "../model/useOvertimeApproval";

const TABS: StatusTab[] = ["PENDING", "APPROVED", "REJECTED", "ALL"];

/** Zona del navegador mientras llega la del servidor en `summary.range`. */
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "Mié 07 oct" de una clave de día (`YYYY-MM-DD`), sin corrimiento de zona. */
const dayLabel = (dayKey: string): string => {
  const text = new Date(`${dayKey}T12:00:00Z`)
    .toLocaleDateString(dateLocale(), { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })
    .replace(/[.,]/g, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "America/Tijuana" → "Tijuana". */
const cityOf = (timezone: string): string => (timezone.split("/").pop() ?? timezone).replace(/_/g, " ");

export default function OvertimeApprovalTable({ fx }: { fx: UseOvertimeApproval }) {
  const { t, canApprove, summary, tab, setTab } = fx;

  const tz = summary?.range.timezone || BROWSER_TIMEZONE;

  const periodLabels = useMemo(
    () => ({
      periods: {
        DAY: t("periodTabs.DAY"),
        WEEK: t("periodTabs.WEEK"),
        FORTNIGHT: t("periodTabs.FORTNIGHT"),
        MONTH: t("periodTabs.MONTH"),
      },
      date: t("filters.date"),
      previous: t("filters.previous"),
      next: t("filters.next"),
    }),
    [t]
  );

  const departmentOptions = useMemo(
    () => [
      { value: "", label: t("filters.allDepartments") },
      ...fx.departments.data.map((d) => ({ value: d.id, label: d.name })),
    ],
    [fx.departments, t]
  );

  // ── Indicadores ────────────────────────────────────────────────────────
  const pendingDays = summary?.pendingDays ?? 0;
  const approvedDays = summary?.approvedDays ?? 0;
  const rejectedDays = summary?.rejectedDays ?? 0;
  const counts: Record<StatusTab, number> = {
    PENDING: pendingDays,
    APPROVED: approvedDays,
    REJECTED: rejectedDays,
    ALL: summary?.totalDays ?? 0,
  };
  const totalMinutes =
    (summary?.pendingMinutes ?? 0) + (summary?.approvedMinutes ?? 0) + (summary?.rejectedMinutes ?? 0);
  // RH solo ve lo aprobado: una sola tarjeta de filtro.
  const visibleTabs: StatusTab[] = canApprove ? TABS : ["APPROVED"];

  // ── Tabla ──────────────────────────────────────────────────────────────
  const renderShift = (r: OvertimeDayRow) => {
    const exit = r.exitAt ? punchTime(r.exitAt, r.date, tz) : null;
    if (r.withoutSchedule) {
      return (
        <ITBadget color="gray" size="sm">
          {t("columns.noSchedule")}
        </ITBadget>
      );
    }
    if (r.restDay) {
      return (
        <ITFlex align="center" gap={2}>
          <ITBadget color="gray" size="sm">
            {t("columns.restDay")}
          </ITBadget>
          {exit && <ITText as="span" className="font-mono text-[12px] text-slate-700">→ {exit}</ITText>}
        </ITFlex>
      );
    }
    return (
      <ITText as="span" className="font-mono text-[12px] text-slate-700">
        {r.shift ?? "—"} → {exit ?? "—"}
      </ITText>
    );
  };

  const renderStatus = (r: OvertimeDayRow) => {
    if (r.status === "PENDING") {
      if (!canApprove) {
        return (
          <ITBadget color="warning" size="sm">
            {t("statusPending")}
          </ITBadget>
        );
      }
      const item = [{ userId: r.userId, date: r.date }];
      return (
        <ITFlex align="center" gap={2}>
          <ITButton
            variant="outlined"
            color="danger"
            size="sm"
            title={t("actions.reject")}
            aria-label={t("actions.reject")}
            disabled={fx.saving}
            onClick={() => fx.startReject(item)}
          >
            <FaTimes size={11} />
          </ITButton>
          <ITButton
            variant="filled"
            color="success"
            size="sm"
            disabled={fx.saving}
            onClick={() => void fx.approveItems(item)}
          >
            <ITFlex align="center" gap={1}>
              <FaCheck size={11} className="text-white" />
              <ITText as="span" className="text-[11px] font-bold text-white">{t("actions.approve")}</ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>
      );
    }
    const approved = r.status === "APPROVED";
    return (
      <ITFlex direction="column" gap={0.5} align="start">
        <ITBadget color={approved ? "success" : "danger"} size="sm">
          {approved ? t("badge.approved") : t("badge.rejected")}
        </ITBadget>
        {r.decidedByName && (
          <ITText className="text-[10px] text-slate-500">{t("decidedByName", { name: r.decidedByName })}</ITText>
        )}
      </ITFlex>
    );
  };

  const selectColumn: Column<OvertimeDayRow> = {
    key: "select",
    // El kit pinta `label` tal cual: aquí va la casilla de "seleccionar pendientes visibles".
    label: (
      <ITCheckbox
        name="overtimeSelectVisible"
        checked={fx.allVisibleSelected}
        disabled={!fx.hasVisiblePending}
        onChange={fx.toggleVisiblePending}
      />
    ) as unknown as string,
    type: "actions",
    width: 56,
    actions: (r) =>
      r.status === "PENDING" ? (
        <ITCheckbox
          name={`sel-${dayKeyOf(r)}`}
          checked={fx.selected.has(dayKeyOf(r))}
          onChange={() => fx.toggleRow(r)}
        />
      ) : null,
  };

  const columns: Column<OvertimeDayRow>[] = [
    ...(canApprove ? [selectColumn] : []),
    {
      key: "employeeName",
      label: t("columns.employee"),
      type: "string",
      width: 260,
      sortable: false,
      render: (r) => {
        const subtitle = [r.employeeNumber ? `#${r.employeeNumber}` : null, r.departmentName]
          .filter(Boolean)
          .join(" · ");
        return (
          <ITFlex align="center" gap={3}>
            <ProfileAvatar
              name={r.employeeName}
              size="md"
            />
            <ITFlex className="min-w-0">
              <ITText className="truncate text-[13px] font-bold text-slate-800">{r.employeeName}</ITText>
              <ITText className="truncate text-[11px] text-slate-500">{subtitle}</ITText>
            </ITFlex>
          </ITFlex>
        );
      },
    },
    {
      // "day": `date` es el ancla del periodo que manda la barra (la API ordena "day" por fecha).
      key: "day",
      label: t("columns.date"),
      type: "string",
      width: 120,
      sortable: true,
      render: (r) => (
        <ITText className="whitespace-nowrap text-[12px] font-semibold text-slate-700">{dayLabel(r.date)}</ITText>
      ),
    },
    {
      key: "shift",
      label: t("columns.shiftExit"),
      type: "string",
      width: 220,
      sortable: false,
      render: renderShift,
    },
    {
      key: "extraMin",
      label: t("columns.extra"),
      type: "number",
      width: 90,
      sortable: true,
      render: (r) => (
        <ITText className="text-[13px] font-black tabular-nums text-[color:color-mix(in_srgb,var(--color-warning)_70%,black)]">
          +{workedTime(canApprove ? r.extraMin : r.approvedExtraMin)}
        </ITText>
      ),
    },
    {
      key: "note",
      label: t("columns.reason"),
      type: "string",
      width: 200,
      sortable: false,
      render: (r) => (
        <ITText className="truncate text-[12px] text-slate-600" title={r.note ?? undefined}>
          {r.note || "—"}
        </ITText>
      ),
    },
    {
      key: "status",
      label: t("status"),
      type: "string",
      width: 190,
      sortable: false,
      render: renderStatus,
    },
  ];

  return (
    <ITFlex direction="column" gap={4}>
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      {/* Filtros por estatus: horas del periodo y cuántos días hay en cada uno. */}
      <BentoFilterCards
        activeId={tab}
        onSelect={(id: string) => setTab(id as StatusTab)}
        items={visibleTabs.map((value) => {
          const hours =
            value === "PENDING"
              ? workedTime(summary?.pendingMinutes ?? 0)
              : value === "APPROVED"
                ? workedTime(summary?.approvedMinutes ?? 0)
                : value === "REJECTED"
                  ? workedTime(summary?.rejectedMinutes ?? 0)
                  : workedTime(totalMinutes);
          const caption = t("tiles.requests", { count: counts[value] });
          return {
            id: value,
            label: value === "ALL" ? t("tabs.ALL") : value === "PENDING" ? t("tiles.pending") : value === "APPROVED" ? t("tiles.approved") : t("tiles.rejected"),
            value: hours,
            caption:
              value === "PENDING"
                ? `${caption} · ${t("tiles.people", { count: summary?.peopleWithPending ?? 0 })}`
                : caption,
          };
        })}
      />

      {/* Una sola tarjeta: filtros, estatus, acciones en lote y la tabla */}
      <ITCard contentClassName="!p-0">
        <ITFlex wrap="wrap" align="end" gap={3} className="border-b border-slate-200/70 px-5 py-4">
          <PeriodPicker
            name="overtime"
            period={fx.period}
            onPeriodChange={fx.changePeriod}
            date={fx.date}
            range={fx.periodRange}
            onDateChange={fx.setDate}
            onPrevious={fx.previousPeriod}
            onNext={fx.nextPeriod}
            labels={periodLabels}
          />
          <ITFlex className="min-w-[200px] flex-1">
            <ITSearchSelect
              name="overtimeDepartment"
              label={t("filters.department")}
              options={departmentOptions}
              value={fx.departmentId}
              onChange={(value) => fx.setDepartmentId(String(value))}
              className="w-full min-w-0"
            />
          </ITFlex>
          <ITFlex className="min-w-[200px] flex-1">
            <ITInput
              name="overtimeEmployee"
              label={t("filters.employee")}
              placeholder={t("filters.employeePlaceholder")}
              value={fx.search}
              onChange={(e) => fx.setSearch(e.target.value)}
              className="w-full min-w-0"
            />
          </ITFlex>
          <ITFlex align="center" gap={1} className="w-full">
            <ITText muted className="!text-[11px]">
              {t("timezone", { city: cityOf(tz) })} · {t("howTo")}
            </ITText>
            <HelpTip text="Tiempo extra = lo trabajado después de la salida programada del turno, menos la tolerancia de salida y solo si alcanza el mínimo del horario. Entrar antes de la hora no genera extra; en día de descanso cuenta todo lo trabajado." />
          </ITFlex>
        </ITFlex>

        {canApprove && fx.selectedCount > 0 && (
          <ITFlex align="center" wrap="wrap" gap={3} className="px-5 pb-2 pt-3">
            <ITFlex align="center" wrap="wrap" gap={2} className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--color-primary)_7%,transparent)] px-3 py-1.5">
              <ITText className="!text-[12px] font-bold">
                {t("bulk.selected", { count: fx.selectedCount })}
              </ITText>
              <ITButton variant="text" color="gray" size="sm" onClick={fx.clearSelection}>
                <ITText className="text-[11px] font-bold">{t("actions.clearSelection")}</ITText>
              </ITButton>
              <ITButton variant="outlined" color="danger" size="sm" disabled={fx.saving} onClick={fx.startRejectSelected}>
                <ITFlex align="center" gap={1}>
                  <FaTimes size={11} />
                  <ITText className="text-[11px] font-bold">{t("actions.reject")}</ITText>
                </ITFlex>
              </ITButton>
              <ITButton variant="filled" color="success" size="sm" disabled={fx.saving} onClick={() => void fx.approveSelected()}>
                <ITFlex align="center" gap={1}>
                  <FaCheck size={11} className="text-white" />
                  <ITText as="span" className="text-[11px] font-bold text-white">{t("actions.approve")}</ITText>
                </ITFlex>
              </ITButton>
            </ITFlex>
          </ITFlex>
        )}

        <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
          key={fx.tableKey}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fx.fetchTableData as unknown as (
              p: Parameters<typeof fx.fetchTableData>[0]
            ) => Promise<{ data: Record<string, unknown>[]; total: number }>
          }
          externalFilters={fx.externalFilters}
          reloadTrigger={fx.reloadKey}
        />

        <ITText muted className="px-5 pb-4 !text-[11px]">
          {t("footnote")}
        </ITText>
      </ITCard>

      {/* Rechazo con motivo opcional */}
      {canApprove && (
        <ITDialog isOpen={!!fx.rejectDraft} onClose={fx.cancelReject} title={t("dialog.rejectTitle")}>
          <ITFlex direction="column" gap={4}>
            <ITText className="text-[12px] text-slate-600">
              {t("dialog.rejectMessage", { count: fx.rejectDraft?.items.length ?? 0 })}
            </ITText>
            <ITTextarea
              name="overtimeRejectNote"
              label={t("dialog.noteLabel")}
              placeholder={t("dialog.notePlaceholder")}
              rows={3}
              value={fx.rejectDraft?.note ?? ""}
              onChange={fx.setRejectNote}
            />
            <ITFlex justify="end" gap={2}>
              <ITButton variant="outlined" color="gray" onClick={fx.cancelReject} disabled={fx.saving}>
                {t("cancel")}
              </ITButton>
              <ITButton variant="filled" color="danger" onClick={() => void fx.confirmReject()} disabled={fx.saving}>
                {t("actions.reject")}
              </ITButton>
            </ITFlex>
          </ITFlex>
        </ITDialog>
      )}

      {canApprove && fx.toast && (
        <ITToast
          message={fx.toast.message}
          type={fx.toast.type}
          position="bottom-center"
          duration={3000}
          onClose={() => fx.setToast(null)}
        />
      )}
    </ITFlex>
  );
}
