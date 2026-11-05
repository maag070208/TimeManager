import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LuArrowLeftRight, LuBoxes, LuClipboardCheck, LuHistory, LuTicket, LuWrench } from "react-icons/lu";
import { personalApi, type EmployeeOverview } from "@entities/hr";
import { ITBentoGrid, ITBentoTile, ITEmptyState } from "@axzydev/axzy_ui_system";
import { LangostinState } from "@shared/ui/langostin";
import { PanelCard } from "@shared/ui/panel-card";
import { dyn } from "@shared/i18n";
import { formatDateTime } from "@shared/utils/dates";
import { ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "secondary";

/** Tono pastel por estado (tokens del kit, sin colores propios). */
const STATUS_TONE: Record<string, Tone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  IN_REVIEW: "primary",
  CLOSED: "success",
  COMPLETED: "success",
  PENDING: "warning",
  ACTIVE: "info",
  PARTIAL: "warning",
  RETURNED: "success",
  CANCELLED: "secondary",
};

function Pill({ value, label }: { value: string; label: string }) {
  const tone = STATUS_TONE[value] ?? "secondary";
  return (
    <ITText as="span"
      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `var(--color-${tone}-soft, var(--color-secondary-100))`, color: `var(--color-${tone})` }}
    >
      {label}
    </ITText>
  );
}

/** Tarjeta de una sección de actividad: `PanelCard` con ícono y conteo; cuerpo con altura máxima. */
function Card({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <PanelCard
      icon={icon}
      title={title}
      actions={<ITText as="span" className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums" style={{ background: "var(--color-secondary-100)" }}>{count}</ITText>}
    >
      <div className="-mx-2 max-h-[22rem] overflow-y-auto">{children}</div>
    </PanelCard>
  );
}

/** Actividad de la persona: indicadores y tarjetas de equipo prestado, tickets, tareas y kardex. */
export default function EmployeeActivity({ userId }: { userId: string }) {
  const { t } = useTranslation("employees");
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    personalApi
      .overview(userId)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : t("detail.activity.error")));
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  if (error) return <LangostinState kind="error" description={error} />;
  if (!data) return <LangostinState kind="loading" title={t("detail.activity.loading")} />;
  const { summary, inventory } = data;
  const openLoans = inventory ? inventory.loans.filter((l) => l.status === "ACTIVE" || l.status === "PARTIAL") : [];
  const label = (key: string) => dyn(t)(`detail.activity.status.${key}`);
  // Abiertos primero: lo que requiere atención no se pierde entre el historial.
  const tickets = [...data.tickets].sort((a, b) => Number(a.status === "CLOSED") - Number(b.status === "CLOSED"));
  const tasks = [...data.tasks].sort((a, b) => Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED"));

  return (
    <ITStack spacing={5}>
      {/* Indicadores compactos: una fila del mosaico, no tarjetas altas. */}
      <ITBentoGrid>
        {inventory && (
          <>
            <ITBentoTile
              cols={3}
              rows={1}
              tone="sea"
              icon={<LuBoxes size={14} />}
              label={t("detail.activity.kpi.units")}
              value={inventory.summary.borrowedUnits}
              caption={t("detail.activity.kpi.unitsHint", { count: inventory.summary.activeLoans })}
            />
            <ITBentoTile
              cols={3}
              rows={1}
              tone="lavender"
              icon={<LuClipboardCheck size={14} />}
              label={t("detail.activity.kpi.letters")}
              value={inventory.summary.activeLoans}
              caption={t("detail.activity.kpi.lettersHint")}
            />
          </>
        )}
        <ITBentoTile
          cols={inventory ? 3 : 6}
          rows={1}
          wide={!inventory}
          tone={summary.openTickets ? "sun" : "mint"}
          icon={<LuTicket size={14} />}
          label={t("detail.activity.kpi.tickets")}
          value={summary.openTickets}
          caption={summary.openTickets ? t("detail.activity.kpi.ticketsHint") : t("detail.activity.kpi.none")}
        />
        <ITBentoTile
          cols={inventory ? 3 : 6}
          rows={1}
          wide={!inventory}
          tone={summary.pendingTasks ? "sun" : "mint"}
          icon={<LuWrench size={14} />}
          label={t("detail.activity.kpi.tasks")}
          value={summary.pendingTasks}
          caption={summary.pendingTasks ? t("detail.activity.kpi.tasksHint") : t("detail.activity.kpi.none")}
        />
      </ITBentoGrid>

      <div className="grid grid-cols-1 items-start gap-4 lg:!grid-cols-2">
        {inventory && (
        <Card icon={<LuBoxes size={15} />} title={t("detail.activity.tabs.loans")} count={openLoans.length}>
          <ul className="divide-y divide-slate-100">
            {openLoans.map((l) => (
              <li key={l.id} className="px-2 py-3">
                <ITFlex align="center" justify="between" gap={3}>
                  <ITText className="font-semibold text-slate-900">{l.number}</ITText>
                  <Pill value={l.status} label={label(l.status)} />
                </ITFlex>
                <ITText className="text-xs text-slate-500">{formatDateTime(l.date)}</ITText>
                <ul className="mt-2 flex flex-col gap-1">
                  {l.items.map((i, idx) => (
                    <li key={idx} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-700" style={{ background: "var(--color-secondary-100)" }}>
                      <ITText as="span" className="font-bold text-slate-900">{i.quantity - i.returned}×</ITText>
                      <ITText as="span" className="truncate">{i.device}</ITText>
                      {i.returned > 0 && <ITText as="span" className="ml-auto text-xs text-[color:var(--color-success)]">{t("detail.activity.returnedCount", { count: i.returned })}</ITText>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {openLoans.length === 0 && <ITEmptyState icon={<LuBoxes size={18} />} title={t("detail.activity.empty.loans")} className="!py-6" />}
        </Card>
        )}

        <Card icon={<LuTicket size={15} />} title={t("detail.activity.tabs.tickets")} count={tickets.length}>
          <ul className="divide-y divide-slate-100">
            {tickets.map((tk) => (
              <li key={tk.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)]" onClick={() => navigate(`/tickets/${tk.id}`)}>
                <ITFlex className="min-w-0">
                  <ITText className="truncate font-semibold text-slate-900">{tk.title}</ITText>
                  <ITText className="text-xs text-slate-500">{dyn(t)(`detail.activity.relation.${tk.relation}`)} · {formatDateTime(tk.createdAt)}</ITText>
                </ITFlex>
                <Pill value={tk.status} label={label(tk.status)} />
              </li>
            ))}
          </ul>
          {tickets.length === 0 && <ITEmptyState icon={<LuTicket size={18} />} title={t("detail.activity.empty.tickets")} className="!py-6" />}
        </Card>

        <Card icon={<LuWrench size={15} />} title={t("detail.activity.tabs.tasks")} count={tasks.length}>
          <ul className="divide-y divide-slate-100">
            {tasks.map((tk) => (
              <li key={tk.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)]" onClick={() => navigate(`/tickets/${tk.ticketId}`)}>
                <ITFlex className="min-w-0">
                  <ITText className="truncate font-semibold text-slate-900">{tk.title}</ITText>
                  <ITText className="truncate text-xs text-slate-500">
                    {tk.ticketTitle}{tk.dueDate ? ` · ${t("detail.activity.due", { date: formatDateTime(tk.dueDate) })}` : ""}
                  </ITText>
                </ITFlex>
                <Pill value={tk.status} label={label(tk.status)} />
              </li>
            ))}
          </ul>
          {tasks.length === 0 && <ITEmptyState icon={<LuWrench size={18} />} title={t("detail.activity.empty.tasks")} className="!py-6" />}
        </Card>

        {inventory && (
        <Card icon={<LuHistory size={15} />} title={t("detail.activity.tabs.kardex")} count={inventory.kardex.length}>
          {inventory.kardex.length > 0 && (
          <ul className="relative ml-4 border-l border-slate-200 py-2">
            {inventory.kardex.map((k, idx) => (
              <li key={`${k.number}-${idx}`} className="relative py-3 pl-6">
                <ITText as="span" className={`absolute -left-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-[var(--it-card-bg)]`} style={{ background: `var(--color-${k.type === "LOAN" ? "info" : "success"}-soft)`, color: `var(--color-${k.type === "LOAN" ? "info" : "success"})` }}>
                  <LuArrowLeftRight size={12} />
                </ITText>
                <ITText className="font-semibold text-slate-900">
                  {dyn(t)(`detail.activity.kardex.${k.type}`)} · {k.number}
                  {k.loanNumber ? <ITText as="span" className="font-normal text-slate-500"> ({k.loanNumber})</ITText> : null}
                </ITText>
                <ITText className="text-xs text-slate-500">{formatDateTime(k.date)}</ITText>
                <ITText className="mt-1 text-sm text-slate-700">
                  {k.items.map((i) => `${i.quantity}× ${i.device}${i.condition ? ` · ${i.condition}` : ""}`).join(", ")}
                </ITText>
              </li>
            ))}
          </ul>
          )}
          {inventory.kardex.length === 0 && <ITEmptyState icon={<LuHistory size={18} />} title={t("detail.activity.empty.kardex")} className="!py-6" />}
        </Card>
        )}
      </div>
    </ITStack>
  );
}
