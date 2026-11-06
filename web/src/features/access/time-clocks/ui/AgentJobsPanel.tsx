import { ITSearchSelect } from "@shared/ui/it-search-select";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITInput,
  ITText,
} from "@axzydev/axzy_ui_system";
import { LuCloudUpload, LuHistory, LuRefreshCw } from "react-icons/lu";
import type { AgentJob, PanelJobType } from "@entities/agent";
import type { TimeClockDevice } from "@entities/time-clock";
import { useAgentJobs } from "../model/useAgentJobs";

const STATUS_COLOR: Record<AgentJob["status"], "gray" | "warning" | "success" | "danger"> = {
  PENDING: "warning",
  RUNNING: "warning",
  DONE: "success",
  FAILED: "danger",
  CANCELLED: "gray",
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

const clockLabel = (clockSerial: string | null): string => clockSerial ?? "—";

/**
 * Cola del agente local (F3-07): el panel encola altas/bajas de personas y
 * tarjetas, y el `CheckLab Agent` del cliente las ejecuta contra el reloj
 * porque la nube no alcanza su red local.
 */
export default function AgentJobsPanel({ clocks }: { clocks: TimeClockDevice[] }) {
  const fx = useAgentJobs(clocks);

  const actionOptions = (["SYNC", "PERSON_ADD", "PERSON_REMOVE", "CARD_ADD"] as PanelJobType[]).map(
    (value) => ({ value, label: fx.t(`agentJobs.actions.${value}`) })
  );

  return (
    <ITCard className="!p-5">
      <ITFlex align="start" justify="between" wrap="wrap" gap={3} className="mb-3">
        <div className="min-w-0">
          <ITFlex align="center" gap={1.5}>
            <LuCloudUpload size={14} className="text-slate-500" aria-hidden />
            <ITText className="text-[13px] font-bold text-slate-800">{fx.t("agentJobs.title")}</ITText>
          </ITFlex>
          <ITText className="mt-0.5 block text-[11px] text-slate-500">{fx.t("agentJobs.description")}</ITText>
        </div>
        <ITButton variant="text" size="sm" className="tm-row-button" onClick={() => void fx.reload()} disabled={fx.busy}>
          <span className="flex items-center gap-1.5">
            <LuRefreshCw size={11} />
            {fx.t("agentJobs.refresh")}
          </span>
        </ITButton>
      </ITFlex>

      {fx.error && (
        <div className="mb-3">
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        </div>
      )}
      {fx.toast && (
        <div className="mb-3">
          <ITAlert variant="success" dismissible onDismiss={() => fx.setToast(null)}>
            {fx.toast}
          </ITAlert>
        </div>
      )}

      {fx.readOnly && (
        <div className="mb-3">
          <ITAlert variant="warning">{fx.t("agentJobs.readOnly")}</ITAlert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <ITSearchSelect
          name="agentJobClock"
          label={fx.t("agentJobs.clock")}
          options={clocks.map((clock) => ({
            value: clock.clockSerial,
            label: clock.name ? `${clock.name} (${clock.clockSerial})` : clock.clockSerial,
          }))}
          value={fx.clockSerial}
          onChange={(event) => fx.setClockSerial(event.target.value)}
        />
        <ITSearchSelect
          name="agentJobAction"
          label={fx.t("agentJobs.action")}
          options={actionOptions}
          value={fx.action}
          onChange={(event) => fx.setAction(event.target.value as PanelJobType)}
        />
        {fx.needsEmployee && (
          <ITInput
            name="agentJobEmployee"
            label={fx.t("agentJobs.employeeNumber")}
            value={fx.employeeNumber}
            onChange={(event) => fx.setEmployeeNumber(event.target.value)}
          />
        )}
        {fx.needsName && (
          <ITInput
            name="agentJobName"
            label={fx.t("agentJobs.name")}
            value={fx.name}
            onChange={(event) => fx.setName(event.target.value)}
          />
        )}
        {fx.needsCard && (
          <ITInput
            name="agentJobCard"
            label={fx.t("agentJobs.cardNo")}
            value={fx.cardNo}
            onChange={(event) => fx.setCardNo(event.target.value)}
          />
        )}
      </div>

      <ITFlex align="center" justify="between" wrap="wrap" gap={2} className="mt-3">
        <ITText className="text-[11px] text-slate-500">
          {fx.t("agentJobs.hint")}
        </ITText>
        <ITButton
          variant="filled"
          color="primary"
          size="sm"
          className="tm-row-button"
          disabled={!fx.canSubmit}
          onClick={() => void fx.submit()}
        >
          {fx.t(fx.busy ? "agentJobs.enqueuing" : "agentJobs.enqueue")}
        </ITButton>
      </ITFlex>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <ITFlex align="center" gap={1.5} className="mb-2">
          <LuHistory size={12} className="text-slate-400" aria-hidden />
          <ITText className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {fx.t("agentJobs.recent")}
          </ITText>
        </ITFlex>
        {fx.jobs === null ? (
          <ITText className="block py-2 text-xs text-slate-500">{fx.t("agentJobs.loading")}</ITText>
        ) : fx.jobs.length === 0 ? (
          <ITText className="block py-2 text-xs text-slate-500">{fx.t("agentJobs.empty")}</ITText>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="agent-jobs-recent">
            {fx.jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                <ITBadget color={STATUS_COLOR[job.status]} size="sm">
                  {fx.t(`agentJobs.status.${job.status}`)}
                </ITBadget>
                <ITText className="font-semibold text-slate-700">
                  {fx.t(`agentJobs.actions.${job.type}`)}
                </ITText>
                <ITText className="text-slate-500">{clockLabel(job.clockSerial)}</ITText>
                <ITText className="ml-auto text-slate-400">{formatDate(job.finishedAt ?? job.createdAt)}</ITText>
                {job.error && <ITText className="w-full text-[11px] text-[#BA1A1A]">{job.error}</ITText>}
              </div>
            ))}
          </div>
        )}
      </div>
    </ITCard>
  );
}
