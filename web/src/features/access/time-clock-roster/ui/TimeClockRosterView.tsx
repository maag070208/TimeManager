import { ITButton, ITFlex, ITSelect, ITText, ITTextarea } from "@axzydev/axzy_ui_system";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { dateLocale, formatDate } from "@shared/i18n/format";
import { useTimeClockRoster } from "../model/useTimeClockRoster";

interface Draft {
  categoryId: string;
  reason: string;
}

const MIN_REASON = 3;

/** Padrón del reloj: nuevos, bajas pendientes con motivo y reapariciones. */
export default function TimeClockRosterView() {
  const { t } = useTranslation("time-clock");
  const navigate = useNavigate();
  const fx = useTimeClockRoster();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const draftOf = (number: string): Draft => drafts[number] ?? { categoryId: "", reason: "" };
  const setDraft = (number: string, changes: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [number]: { ...draftOf(number), ...changes } }));

  // Los motivos vienen del catálogo de la base de datos (con su nombre editable).
  const categoryOptions = fx.categories.map((c) => ({ value: c.id, label: c.name }));

  const last = fx.data?.lastRun ?? null;

  return (
    <ITFlex direction="column" gap={4} className="p-6">
      <ITFlex align="center" justify="between" gap={3} wrap="wrap">
        <ITFlex direction="column" gap={1}>
          <ITText className="text-sm text-slate-500">{t("roster.description")}</ITText>
          <ITText className="text-xs text-slate-400">
            {last
              ? t("roster.lastRun", {
                  date: new Date(last.finishedAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }),
                  status: last.suspicious
                    ? t("roster.suspiciousBadge")
                    : last.ok
                      ? t("roster.okBadge")
                      : t("roster.noReadBadge"),
                })
              : t("roster.lastRunNone")}
          </ITText>
        </ITFlex>
        {fx.canRun && (
          <ITButton variant="filled" color="primary" size="sm" disabled={fx.running} onClick={() => void fx.runReview()}>
            {fx.running ? t("roster.running") : t("roster.run")}
          </ITButton>
        )}
      </ITFlex>

      {fx.error && <ITText role="alert" className="text-sm text-red-600">{fx.error}</ITText>}
      {fx.toast && (
        <ITText role="status" className="text-sm text-emerald-700" onClick={fx.dismissToast}>
          {fx.toast}
        </ITText>
      )}
      {fx.loading && <ITText className="text-sm text-slate-400">{t("roster.loading")}</ITText>}

      {fx.data && (
        <>
          <Section title={t("roster.sections.unlinked")} empty={t("roster.empty.unlinked")} count={fx.data.unlinked.length}>
            {fx.data.unlinked.map((p) => (
              <Row key={p.employeeNumber}>
                <ProfileAvatar name={p.name} size="sm" />
                <ITFlex direction="column" gap={0} className="min-w-0">
                  <ITText className="font-semibold text-slate-800">{p.name}</ITText>
                  <ITText className="text-xs text-slate-500">
                    {t("roster.row.number", { number: p.employeeNumber })} · {p.clocks.join(", ")}
                  </ITText>
                </ITFlex>
                {fx.canLink && (
                  <ITButton variant="outlined" color="secondary" size="sm" onClick={() => navigate("/hr/time-clock/employees")}>
                    {t("roster.row.link")}
                  </ITButton>
                )}
              </Row>
            ))}
          </Section>

          <Section title={t("roster.sections.pending")} empty={t("roster.empty.pending")} count={fx.data.pendingRemovals.length}>
            {fx.data.pendingRemovals.map((r) => {
              const draft = draftOf(r.employeeNumber);
              const valid = draft.categoryId !== "" && draft.reason.trim().length >= MIN_REASON;
              const busy = fx.busyNumber === r.employeeNumber;
              return (
                <div key={r.employeeNumber} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[var(--it-card-bg)] p-4">
                  <ITFlex direction="column" gap={0}>
                    <ITText className="font-semibold text-slate-800">{r.userName}</ITText>
                    <ITText className="text-xs text-slate-500">
                      {t("roster.row.number", { number: r.employeeNumber })} ·{" "}
                      {t("roster.row.missingSince", {
                        date: r.missingSince ? formatDate(r.missingSince, { dateStyle: "medium" }) : "—",
                      })}
                    </ITText>
                  </ITFlex>
                  {fx.canRemove && (
                    <ITFlex direction="column" gap={2}>
                      <ITSelect
                        name={`category-${r.employeeNumber}`}
                        label={t("roster.form.category")}
                        options={categoryOptions}
                        value={draft.categoryId}
                        onChange={(e) => setDraft(r.employeeNumber, { categoryId: e.target.value })}
                      />
                      <ITTextarea
                        name={`reason-${r.employeeNumber}`}
                        label={t("roster.form.reason")}
                        value={draft.reason}
                        onChange={(v) => setDraft(r.employeeNumber, { reason: v })}
                        rows={2}
                      />
                      <ITText className="text-xs text-slate-400">{t("roster.form.reasonHint", { min: MIN_REASON })}</ITText>
                    </ITFlex>
                  )}
                  <ITFlex gap={2} justify="end" wrap="wrap">
                    {fx.canLink && (
                      <ITButton
                        variant="outlined"
                        color="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void fx.dismissRemoval(r.employeeNumber)}
                      >
                        {t("roster.form.dismiss")}
                      </ITButton>
                    )}
                    {fx.canRemove && (
                      <ITButton
                        variant="filled"
                        color="danger"
                        size="sm"
                        disabled={busy || !valid}
                        onClick={async () => {
                          const ok = await fx.applyRemoval(r.employeeNumber, {
                            categoryId: draft.categoryId,
                            reason: draft.reason.trim(),
                            notifyUser: false,
                          });
                          if (ok) setDrafts((d) => ({ ...d, [r.employeeNumber]: { categoryId: "", reason: "" } }));
                        }}
                      >
                        {t("roster.form.apply")}
                      </ITButton>
                    )}
                  </ITFlex>
                </div>
              );
            })}
          </Section>

          <Section title={t("roster.sections.reappeared")} empty={t("roster.empty.reappeared")} count={fx.data.reappeared.length}>
            {fx.data.reappeared.map((r) => (
              <Row key={r.employeeNumber}>
                <ITFlex direction="column" gap={0} className="min-w-0">
                  <ITText className="font-semibold text-slate-800">{r.userName}</ITText>
                  <ITText className="text-xs text-slate-500">
                    {t("roster.row.number", { number: r.employeeNumber })} ·{" "}
                    {t("roster.row.reappearedAt", {
                      date: r.reappearedAt ? formatDate(r.reappearedAt, { dateStyle: "medium" }) : "—",
                    })}
                  </ITText>
                </ITFlex>
                <ITButton variant="outlined" color="secondary" size="sm" onClick={() => navigate(`/users/${r.userId}/history`)}>
                  {t("roster.row.viewUser")}
                </ITButton>
              </Row>
            ))}
          </Section>
        </>
      )}
    </ITFlex>
  );
}

function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <ITFlex direction="column" gap={2}>
      <ITText className="text-sm font-bold text-slate-700">
        {title} <ITText as="span" className="font-normal text-slate-400">({count})</ITText>
      </ITText>
      {count === 0 ? <ITText className="text-sm text-slate-400">{empty}</ITText> : children}
    </ITFlex>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ITFlex align="center" justify="between" gap={3} className="rounded-xl border border-slate-200 bg-[var(--it-card-bg)] px-4 py-3">
      {children}
    </ITFlex>
  );
}
