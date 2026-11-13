import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendarClock, LuClipboardList, LuFileText, LuFingerprint, LuUserRound } from "react-icons/lu";
import { personalApi, type EmployeeOverview } from "@entities/hr";
import { ITBadget, ITEmptyState, ITFlex, ITStack, ITText } from "@axzydev/axzy_ui_system";
import { TicState } from "@shared/ui/tic";
import { PanelCard } from "@shared/ui/panel-card";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { formatDateTime } from "@shared/utils/dates";

/** Tarjeta de una sección de actividad: `PanelCard` con ícono y conteo; cuerpo con altura máxima. */
function Card({ icon, title, count, tone, children }: { icon: React.ReactNode; title: string; count: number; tone: "sky" | "lavender"; children: React.ReactNode }) {
  return (
    <PanelCard
      className={`tm-hero-card tm-hero-card--${tone}`}
      icon={icon}
      title={title}
      actions={<ITText as="span" className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums" style={{ background: "var(--color-secondary-100)" }}>{count}</ITText>}
    >
      <div className="-mx-2 max-h-[22rem] overflow-y-auto">{children}</div>
    </PanelCard>
  );
}

/** Actividad de la persona: documentos del expediente, checadas recientes, actas y horario vigente. */
export default function EmployeeActivity({ userId }: { userId: string }) {
  const { t } = useTranslation("employees");
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

  if (error) return <TicState kind="error" description={error} />;
  if (!data) return <ContentSkeleton />;
  const { employee, summary, schedule, documents, punches } = data;
  const METHOD_LABELS = {
    FACE: "detail.activity.method.FACE",
    FINGERPRINT: "detail.activity.method.FINGERPRINT",
    CARD: "detail.activity.method.CARD",
    OTHER: "detail.activity.method.OTHER",
  } as const;
  const method = (value: string) =>
    t(METHOD_LABELS[value as keyof typeof METHOD_LABELS] ?? METHOD_LABELS.OTHER);
  const isRemote = (punch: (typeof punches)[number]) => punch.source === "WEB" || punch.source === "APP";
  const sourceLabel = (punch: (typeof punches)[number]) =>
    punch.source === "WEB" || punch.source === "APP" ? t(`detail.activity.source.${punch.source}`) : t("detail.activity.source.CLOCK");

  return (
    <ITStack spacing={5}>
      <BentoKpiGrid
        items={[
          { id: "documents", label: t("detail.activity.kpi.documents"), value: summary.documents, caption: t("detail.activity.kpi.documentsHint"), icon: <LuFileText size={14} />, tone: "success" },
          { id: "missing", label: t("detail.activity.kpi.missing"), value: summary.missingRequiredDocuments, caption: summary.missingRequiredDocuments > 0 ? t("detail.activity.kpi.missingHint") : t("detail.activity.kpi.none"), icon: <LuClipboardList size={14} />, tone: summary.missingRequiredDocuments > 0 ? "warning" : "success" },
          { id: "punches", label: t("detail.activity.kpi.punches"), value: summary.punchesLast30Days, caption: t("detail.activity.kpi.punchesHint"), icon: <LuFingerprint size={14} />, tone: "info" },
          { id: "disciplines", label: t("detail.activity.kpi.disciplines"), value: summary.disciplinaryReportsLastYear, caption: summary.disciplinaryReportsLastYear > 0 ? t("detail.activity.kpi.disciplinesHint") : t("detail.activity.kpi.none"), icon: <LuUserRound size={14} />, tone: summary.disciplinaryReportsLastYear > 0 ? "warning" : "success" },
        ]}
      />

      <ITFlex align="center" gap={2} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
        <LuCalendarClock size={14} className="shrink-0 text-slate-500" />
        <ITText className="text-sm text-slate-700 dark:text-slate-200">
          {t("detail.activity.schedule")}:{" "}
          <ITText as="b" className="text-slate-900 dark:text-slate-100">
            {schedule ? schedule.name : t("detail.activity.noSchedule")}
          </ITText>
          {employee.employeeNumber ? (
            <ITText as="span" className="ml-2 text-xs text-slate-500">
              #{employee.employeeNumber}
            </ITText>
          ) : null}
        </ITText>
      </ITFlex>

      <div className="grid grid-cols-1 items-start gap-4 lg:!grid-cols-2">
        <Card icon={<LuFileText size={15} />} title={t("detail.activity.tabs.documents")} count={documents.length} tone="sky">
          <ul className="flex flex-col gap-1.5">
            {documents.map((document) => (
              <li key={document.id} className="rounded-xl bg-slate-50/70 px-3 py-2">
                <ITText className="block truncate font-semibold text-slate-900">{document.name}</ITText>
                <ITText className="text-[11.5px] text-slate-500">{document.type} · {formatDateTime(document.uploadedAt)}</ITText>
              </li>
            ))}
          </ul>
          {documents.length === 0 && (
            <ITEmptyState icon={<LuFileText size={18} />} title={t("detail.activity.empty.documents")} className="!py-6" />
          )}
        </Card>

        <Card icon={<LuFingerprint size={15} />} title={t("detail.activity.tabs.punches")} count={punches.length} tone="lavender">
          <ul className="flex flex-col gap-1.5">
            {punches.map((punch) => (
              <li key={punch.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/70 px-3 py-2">
                <ITFlex align="center" gap={2} className="min-w-0">
                  <ITBadget color="info" size="sm">{isRemote(punch) ? sourceLabel(punch) : method(punch.method)}</ITBadget>
                  <ITText className="truncate !text-[11.5px] text-slate-500">{isRemote(punch) ? t(punch.source === "APP" ? "detail.activity.source.APP_HINT" : "detail.activity.source.WEB_HINT") : punch.clock ?? t("detail.activity.source.CLOCK")}</ITText>
                </ITFlex>
                <ITText className="shrink-0 !text-[11.5px] tabular-nums text-slate-500">{formatDateTime(punch.occurredAt)}</ITText>
              </li>
            ))}
          </ul>
          {punches.length === 0 && (
            <ITEmptyState icon={<LuFingerprint size={18} />} title={t("detail.activity.empty.punches")} className="!py-6" />
          )}
        </Card>
      </div>
    </ITStack>
  );
}
