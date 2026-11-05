import { useMemo, useState } from "react";
import { ITAlert, ITButton, ITCard, ITFlex, ITSlideToggle, ITStack, ITText } from "@axzydev/axzy_ui_system";
import { FaArrowDown, FaArrowUp, FaCheckCircle, FaEdit, FaLightbulb, FaLock, FaPlus, FaVial } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PolicyAdmin } from "@entities/permission";
import { LottieLoader } from "@shared/ui/lottie-loader";
import type { PoliciesState } from "../../model/usePolicies";
import PolicySentence from "../shared/PolicySentence";
import PolicyEditorDialog, { type PolicySubmit } from "../PolicyEditorDialog";

interface Props {
  policies: PoliciesState;
  onTest: (permission: string) => void;
  notify: (message: string, type: "success" | "error") => void;
}

/**
 * Pestaña "Reglas" (ABAC). Cada acción se lee como una historia: "Quien pueda
 * aprobar órdenes de compra… 1. Si es ADMIN → puede. 2. Si la orden la creó la
 * misma persona → no puede. En cualquier otro caso → puede". Las reglas se
 * activan con un interruptor y se reordenan con flechas.
 */
export default function PoliciesPanel({ policies, onTest, notify }: Props) {
  const { t } = useTranslation("roles");
  const { data, loading, error, saving, create, update, remove, setActive, move } = policies;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PolicyAdmin | null>(null);
  const [newForAction, setNewForAction] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!data) return [];
    const keys = [...new Set([...data.actions.map((action) => action.key), ...data.policies.map((policy) => policy.action)])];
    return keys.map((key) => ({
      key,
      action: data.actions.find((action) => action.key === key),
      rules: data.policies.filter((policy) => policy.action === key).sort((a, b) => a.priority - b.priority),
    }));
  }, [data]);

  const openNew = (action: string | null) => {
    setEditing(null);
    setNewForAction(action);
    setEditorOpen(true);
  };

  const handleSubmit = async (submit: PolicySubmit): Promise<boolean> => {
    const result =
      submit.mode === "create" ? await create(submit.payload) : submit.id ? await update(submit.id, submit.payload) : { ok: false };
    notify(
      result.ok ? (submit.mode === "create" ? t("policies.created") : t("policies.updated")) : result.error ?? t("policies.saveError"),
      result.ok ? "success" : "error"
    );
    return result.ok;
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const result = await remove(id);
    notify(result.ok ? t("policies.deleted") : result.error ?? t("policies.saveError"), result.ok ? "success" : "error");
    return result.ok;
  };

  const runQuick = async (promise: Promise<{ ok: boolean; error?: string }>) => {
    const result = await promise;
    if (!result.ok) notify(result.error ?? t("policies.saveError"), "error");
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <LottieLoader />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ITAlert variant="error" dismissible={false}>
        {error ?? t("policies.loadError")}
      </ITAlert>
    );
  }

  return (
    <ITStack spacing={3}>
      <ITFlex align="start" justify="between" wrap="wrap" gap={3}>
        <div className="flex max-w-3xl items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <FaLightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
          <ITText className="text-[11px] leading-relaxed text-amber-900">{t("policies.explainer")}</ITText>
        </div>
        <ITButton variant="filled" color="primary" size="sm" onClick={() => openNew(null)}>
          <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
            <FaPlus size={10} /> {t("policies.new")}
          </ITText>
        </ITButton>
      </ITFlex>

      {grouped.map(({ key, action, rules }) => (
        <ITCard key={key} contentClassName="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
            <ITText className="text-[12px] text-slate-600">
              {t("policies.story.whoCan")} <ITText as="b" className="text-slate-900">{(action?.label ?? key).toLowerCase()}</ITText>
              {action && <ITText as="span" className="text-slate-400"> · {action.module}</ITText>}
            </ITText>
            <ITText as="span" className="flex items-center gap-1">
              <ITButton variant="text" color="primary" size="sm" onClick={() => openNew(key)}>
                <ITFlex align="center" gap={1}>
                  <FaPlus size={8} />
                  <ITText className="text-[10px] font-bold">{t("policies.addRule")}</ITText>
                </ITFlex>
              </ITButton>
              <button
                type="button"
                onClick={() => onTest(key)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 !bg-[var(--it-card-bg)] px-2 py-1 text-[10px] font-bold text-primary-500 hover:border-primary-500"
              >
                <FaVial size={9} /> {t("simulator.test")}
              </button>
            </ITText>
          </div>

          <ol className="divide-y divide-slate-100">
            {rules.map((policy, index) => (
              <li
                key={policy.id}
                className={`flex flex-wrap items-center gap-2 px-3 py-2 ${policy.active ? "" : "bg-slate-50/60"}`}
              >
                <ITText as="span"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    policy.active ? "bg-primary-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {index + 1}
                </ITText>
                <div className={`min-w-[260px] flex-1 ${policy.active ? "" : "opacity-50"}`}>
                  <PolicySentence policy={policy} action={action} />
                  <ITText className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                    {policy.key && <FaLock size={7} />}
                    {policy.name}
                    {!policy.active && <ITText as="span" className="font-bold text-amber-600"> · {t("policies.inactive")}</ITText>}
                  </ITText>
                </div>
                <ITText as="span" className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={saving || index === 0}
                    onClick={() => void runQuick(move(rules, index, -1))}
                    title={t("policies.moveUp")}
                    className="flex h-6 w-6 items-center justify-center rounded-md !bg-transparent text-slate-400 hover:!bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <FaArrowUp size={9} />
                  </button>
                  <button
                    type="button"
                    disabled={saving || index === rules.length - 1}
                    onClick={() => void runQuick(move(rules, index, 1))}
                    title={t("policies.moveDown")}
                    className="flex h-6 w-6 items-center justify-center rounded-md !bg-transparent text-slate-400 hover:!bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <FaArrowDown size={9} />
                  </button>
                  <ITText as="span" title={policy.active ? t("policies.turnOff") : t("policies.turnOn")}>
                    <ITSlideToggle
                      size="sm"
                      activeColor="var(--color-primary)"
                      isOn={policy.active}
                      disabled={saving}
                      onToggle={(active) => void runQuick(setActive(policy, active))}
                    />
                  </ITText>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(policy);
                      setEditorOpen(true);
                    }}
                    title={t("policies.edit")}
                    className="flex h-6 w-6 items-center justify-center rounded-md !bg-transparent text-primary-500 hover:!bg-primary-500/10"
                  >
                    <FaEdit size={10} />
                  </button>
                </ITText>
              </li>
            ))}
            <li className="flex items-center gap-2 px-3 py-2">
              <ITText as="span" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <FaCheckCircle size={10} />
              </ITText>
              <ITText as="span" className="text-[11px] text-slate-500">
                {rules.length === 0 ? t("policies.story.noRules") : t("policies.story.otherwise")}
              </ITText>
            </li>
          </ol>
        </ITCard>
      ))}

      <PolicyEditorDialog
        isOpen={editorOpen}
        policy={editing}
        actions={data.actions}
        policies={data.policies}
        initialAction={newForAction}
        saving={saving}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </ITStack>
  );
}
