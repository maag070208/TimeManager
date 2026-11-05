import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ITAlert, ITInput, ITSearchSelect, ITSelect, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { FaCheck, FaCheckCircle, FaIdCard, FaKey, FaMinus, FaTimes, FaTimesCircle, FaUserShield } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type {
  AccessMember,
  AccessSimulation,
  PermissionCatalog,
  PolicyActionDef,
  RuleTrace,
} from "@entities/permission";
import { roleLabel } from "@entities/user";
import { dyn } from "@shared/i18n/dyn";
import { memberRoles } from "../../model/useAccessMembers";
import { useAccessSimulator } from "../../model/useUserAccess";
import { ScopeChip } from "../shared/Scope";
import { RoleChip } from "../shared/RoleAvatar";
import { useConditionValue } from "../shared/useConditionValue";
import { DialogSection } from "../shared/DialogParts";

const SELF = "__self__";
const OTHER = "__other__";
/** Identificador que no coincide con nadie: representa "otra persona" en los campos de usuario. */
const OTHER_PERSON_ID = "00000000-0000-0000-0000-000000000000";

interface Props {
  catalog: readonly PermissionCatalog[];
  actions: readonly PolicyActionDef[];
  /** Persona precargada (desde el visor o un acceso denegado). */
  initialUserId?: string | null;
  members?: readonly AccessMember[];
  initialPermission?: string | null;
}

type StepState = "ok" | "fail" | "skip";

function Step({
  index,
  title,
  icon,
  state,
  children,
}: {
  index: number;
  title: string;
  icon: ReactNode;
  state: StepState;
  children: ReactNode;
}) {
  const style = {
    ok: { ring: "border-emerald-200 bg-emerald-50/40", badge: "bg-emerald-500 text-white", icon: <FaCheck size={10} /> },
    fail: { ring: "border-rose-200 bg-rose-50/40", badge: "bg-rose-500 text-white", icon: <FaTimes size={10} /> },
    skip: { ring: "border-slate-200 bg-slate-50", badge: "bg-slate-300 text-white", icon: <FaMinus size={10} /> },
  }[state];
  return (
    <div className={`relative flex flex-col gap-1.5 rounded-xl border p-3 ${style.ring}`}>
      <ITFlex align="center" gap={2}>
        <ITText as="span" className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--it-card-bg)] text-slate-500 shadow-sm">{icon}</ITText>
        <ITText as="span" className="text-[12px] font-semibold text-slate-400">{index}</ITText>
        <ITText as="span" className="text-[12px] font-black text-slate-700">{title}</ITText>
        <ITText as="span" className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full ${style.badge}`}>{style.icon}</ITText>
      </ITFlex>
      <div className="text-[11px] leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

const formatValue = (value: unknown): string => (value === null || value === undefined || value === "" ? "—" : String(value));

/**
 * Probador del control de acceso: recorre en la API las mismas capas que una
 * petición real — Identidad → RBAC (permiso y alcance) → ABAC (políticas sobre
 * el registro) — y muestra la traza de cada regla.
 */
export default function AccessSimulator({ catalog, actions, initialUserId = null, members = [], initialPermission = null }: Props) {
  const { t } = useTranslation("roles");
  const tt = dyn(t);
  const valueText = useConditionValue();
  const simulator = useAccessSimulator();
  const { reset } = simulator;
  const [person, setPerson] = useState<string>(initialUserId ?? "");
  const [permission, setPermission] = useState<string>(initialPermission ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});

  const subject = person;
  const action = actions.find((item) => item.key === permission);
  const activeCatalog = useMemo(() => catalog.filter((item) => item.active), [catalog]);
  const nameOf = (key: string) => catalog.find((item) => item.key === key)?.name ?? key;
  const scoped = catalog.find((item) => item.key === permission)?.scopes.some((s) => s === "OWN" || s === "AREA") ?? false;

  useEffect(() => {
    if (initialUserId) setPerson(initialUserId);
  }, [initialUserId]);

  useEffect(() => {
    if (initialPermission) setPermission(initialPermission);
  }, [initialPermission]);

  useEffect(() => {
    setFields({});
    reset();
  }, [permission, subject, reset]);

  const { run } = simulator;
  // El resultado se calcula solo al elegir persona y acción (y al cambiar los datos del registro).
  useEffect(() => {
    if (!subject || !permission) return;
    const timer = setTimeout(() => {
      const resource: Record<string, string | number | null> = {};
      for (const field of action?.fields ?? []) {
        const raw = fields[field.key] ?? "";
        if (raw === "") continue;
        if (field.type === "user") resource[field.key] = raw === SELF ? subject : OTHER_PERSON_ID;
        else if (field.type === "number") resource[field.key] = Number(raw);
        else resource[field.key] = raw;
      }
      void run({ userId: subject, permission, resource });
    }, 300);
    return () => clearTimeout(timer);
  }, [subject, permission, fields, action, run]);

  const result: AccessSimulation | null = simulator.result;
  const subjectMember = members.find((member) => member.id === subject);

  const rbacDetail = (sim: AccessSimulation) => {
    if (!sim.rbac.permissionActive) return <ITText>{t("simulator.rbac.inactivePermission")}</ITText>;
    if (sim.rbac.exception) {
      return (
        <ITStack spacing={1}>
          <ITText>{t("simulator.rbac.exception")}</ITText>
          <ITFlex align="center" wrap="wrap" gap={1.5}>
            <ScopeChip scope={sim.rbac.exception.scope} scoped={scoped} />
            {sim.rbac.exception.reason && <ITText as="span" className="italic">“{sim.rbac.exception.reason}”</ITText>}
          </ITFlex>
        </ITStack>
      );
    }
    const sources = Object.entries(sim.rbac.byRole);
    if (sources.length === 0) {
      const roles = subjectMember ? memberRoles(subjectMember).map(roleLabel).join(", ") : "";
      return <ITText>{t("simulator.rbac.noRole", { roles })}</ITText>;
    }
    return (
      <ITStack spacing={1.5}>
        <ITText>{t("simulator.rbac.grantedBy")}</ITText>
        <ITFlex wrap="wrap" gap={1.5}>
          {sources.map(([role, scope]) => (
            <ITText as="span" key={role} className="inline-flex items-center gap-1">
              <RoleChip role={role} />
              <ScopeChip scope={scope} scoped={scoped} />
            </ITText>
          ))}
        </ITFlex>
      </ITStack>
    );
  };

  const abacDetail = (sim: AccessSimulation) => {
    if (!sim.identity.ok || !sim.rbac.ok) return <ITText>{t("simulator.abac.notEvaluated")}</ITText>;
    if (!sim.abac.hasRules) return <ITText>{t("simulator.abac.noRules")}</ITText>;
    const decided = sim.abac.explanation?.decidedBy;
    if (!decided) return <ITText>{t("simulator.abac.noneMatched")}</ITText>;
    return (
      <ITText>
        {t("simulator.abac.decidedBy", { name: decided.name })}{" "}
        <ITText as="span" className={`font-black ${decided.effect === "DENY" ? "text-rose-600" : "text-emerald-600"}`}>
          {t(`policies.effect.${decided.effect}`)}
        </ITText>
      </ITText>
    );
  };

  const traceRow = (rule: RuleTrace, decidedId: string | undefined) => (
    <li
      key={rule.id}
      className={`rounded-xl border px-3 py-2 ${
        rule.id === decidedId ? "border-primary-500 bg-primary-500/5" : "border-slate-200 bg-[var(--it-card-bg)]"
      } ${rule.active ? "" : "opacity-50"}`}
    >
      <ITFlex align="center" wrap="wrap" gap={2}>
        <ITText as="span" className="rounded bg-slate-100 px-1.5 text-[10px] font-black text-slate-500">#{rule.priority}</ITText>
        <ITText as="span" className="text-[12px] font-bold text-slate-700">{rule.name}</ITText>
        <ITText as="span"
          className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${
            rule.effect === "DENY" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {t(`policies.effect.${rule.effect}`)}
        </ITText>
        {!rule.active && <ITText as="span" className="text-[10px] font-bold text-amber-600">{t("policies.inactive")}</ITText>}
        <ITText as="span" className={`text-[10px] font-bold ${rule.appliesToUser ? "text-emerald-600" : "text-slate-400"}`}>
          {rule.appliesToUser ? t("simulator.trace.appliesToRole") : t("simulator.trace.notForRole")}
        </ITText>
        <ITText as="span" className="ml-auto text-[10px] font-black">
          {rule.matches ? (
            <ITText as="span" className="text-primary-500">{rule.id === decidedId ? t("simulator.trace.decides") : t("simulator.trace.matches")}</ITText>
          ) : (
            <ITText as="span" className="text-slate-400">{t("simulator.trace.noMatch")}</ITText>
          )}
        </ITText>
      </ITFlex>
      {rule.conditions.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {rule.conditions.map((condition, index) => {
            const field = action?.fields.find((item) => item.key === condition.field);
            return (
              <li key={index} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {condition.matches ? (
                  <FaCheckCircle size={11} className="text-emerald-500" />
                ) : (
                  <FaTimesCircle size={11} className="text-slate-300" />
                )}
                <ITText as="span" className="font-bold text-slate-700">{field?.label ?? condition.field}</ITText>
                <ITText as="span" className="text-slate-500">{tt(`policies.operator.${condition.operator}`)}</ITText>
                {condition.value != null && <ITText as="span" className="font-bold text-primary-500">{valueText(condition.value)}</ITText>}
                <ITText as="span" className="text-slate-400">
                  ({t("simulator.trace.actual")}:{" "}
                  {field?.type === "user" && condition.actual === subject
                    ? t("policies.ref.userId")
                    : field?.type === "user" && condition.actual === OTHER_PERSON_ID
                      ? t("simulator.other")
                      : formatValue(condition.actual)}
                  )
                </ITText>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );

  return (
    <ITStack spacing={4}>
      <ITText className="text-[11px] text-slate-500">{t("simulator.subtitle")}</ITText>
      <div className="grid gap-4 md:!grid-cols-2">
        <DialogSection step={1} title={t("simulator.who")}>
          <ITSearchSelect
            name="simulator_person"
            size="sm"
            placeholder={t("simulator.personPlaceholder")}
            options={members.map((member) => ({ value: member.id, label: `${member.name} · @${member.username}` }))}
            value={person}
            onChange={(value) => setPerson(String(value ?? ""))}
            onClear={() => setPerson("")}
          />
        </DialogSection>
        <DialogSection step={2} title={t("simulator.what")}>
          <ITSearchSelect
            name="simulator_permission"
            size="sm"
            placeholder={t("simulator.permissionPlaceholder")}
            options={activeCatalog.map((item) => ({ value: item.key, label: `${item.name} · ${item.module}` }))}
            value={permission}
            onChange={(value) => setPermission(String(value ?? ""))}
            onClear={() => setPermission("")}
          />
        </DialogSection>
      </div>

      {action && action.fields.length > 0 && (
        <DialogSection step={3} title={t("simulator.context")} hint={t("simulator.contextHint")}>
          <div className="grid gap-3 sm:!grid-cols-2">
            {action.fields.map((field) =>
              field.type === "number" ? (
                <ITInput
                  key={field.key}
                  name={`sim_${field.key}`}
                  size="sm"
                  type="number"
                  label={field.label}
                  value={fields[field.key] ?? ""}
                  onChange={(event) => setFields((previous) => ({ ...previous, [field.key]: event.target.value }))}
                />
              ) : (
                <ITSelect
                  key={field.key}
                  name={`sim_${field.key}`}
                  size="sm"
                  label={field.label}
                  value={fields[field.key] ?? ""}
                  onChange={(event) => setFields((previous) => ({ ...previous, [field.key]: event.target.value }))}
                  options={[
                    { value: "", label: t("simulator.noValue") },
                    ...(field.type === "user"
                      ? [
                          { value: SELF, label: t("simulator.self") },
                          { value: OTHER, label: t("simulator.other") },
                        ]
                      : field.type === "boolean"
                        ? [
                            { value: "true", label: t("simulator.yes") },
                            { value: "false", label: t("simulator.no") },
                          ]
                        : (field.options ?? []).map((option) => ({ value: option, label: option }))),
                  ]}
                />
              )
            )}
          </div>
        </DialogSection>
      )}

      {(!subject || !permission) && (
        <ITText className="rounded-lg bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">{t("simulator.pickBoth")}</ITText>
      )}
      {simulator.running && !result && <ITText className="text-center text-[11px] text-slate-400">{t("simulator.running")}</ITText>}

      {simulator.error && (
        <ITAlert variant="error" dismissible onDismiss={reset}>
          {simulator.error}
        </ITAlert>
      )}

      {result && (
        <ITStack spacing={3}>
          <div
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              result.allowed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
            }`}
          >
            {result.allowed ? (
              <FaCheckCircle size={18} className="text-emerald-500" />
            ) : (
              <FaTimesCircle size={18} className="text-rose-500" />
            )}
            <div>
              <ITText className={`text-[13px] font-black ${result.allowed ? "text-emerald-700" : "text-rose-700"}`}>
                {result.allowed ? t("simulator.allowed") : t("simulator.denied")}
              </ITText>
              <ITText className="text-[11px] text-slate-600">
                {result.allowed
                  ? t("simulator.allowedDetail", { permission: nameOf(permission), scope: t(`scopePlain.${result.rbac.scope}`) })
                  : result.abac.explanation?.decision.reason ?? t("simulator.deniedDetail", { permission: nameOf(permission) })}
              </ITText>
            </div>
          </div>

          <div className="grid gap-3 md:!grid-cols-3">
            <Step index={1} title={t("simulator.steps.identity")} icon={<FaIdCard size={12} />} state={result.identity.ok ? "ok" : "fail"}>
              {result.identity.ok ? t("simulator.identity.active") : t("simulator.identity.inactive")}
            </Step>
            <Step
              index={2}
              title={t("simulator.steps.rbac")}
              icon={<FaKey size={12} />}
              state={!result.identity.ok ? "skip" : result.rbac.ok ? "ok" : "fail"}
            >
              {rbacDetail(result)}
            </Step>
            <Step
              index={3}
              title={t("simulator.steps.abac")}
              icon={<FaUserShield size={12} />}
              state={!result.abac.evaluated ? (result.identity.ok && result.rbac.ok ? "ok" : "skip") : result.abac.ok ? "ok" : "fail"}
            >
              {abacDetail(result)}
            </Step>
          </div>

          {result.identity.ok && !result.rbac.ok && result.rbac.permissionActive && (
            <ITText className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{t("simulator.howToGrant")}</ITText>
          )}

          {result.abac.explanation && result.abac.explanation.rules.length > 0 && (
            <div>
              <ITText className="mb-2 text-[12px] font-semibold text-slate-400">{t("simulator.trace.title")}</ITText>
              <ol className="flex flex-col gap-2">
                {result.abac.explanation.rules.map((rule) => traceRow(rule, result.abac.explanation?.decidedBy?.id))}
              </ol>
              <ITText className="mt-2 text-[10px] italic text-slate-400">{t("policies.priorityHint")}</ITText>
            </div>
          )}
        </ITStack>
      )}
    </ITStack>
  );
}
