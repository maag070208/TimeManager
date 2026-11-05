import { useEffect, useMemo, useState } from "react";
import { ITButton, ITDialog, ITInput, ITSelect, ITTextarea, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { FaBan, FaCheckCircle, FaChevronDown, FaChevronRight, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type {
  PolicyActionDef,
  PolicyAdmin,
  PolicyCondition,
  PolicyEffect,
  PolicyFieldDef,
} from "@entities/permission";
import { useRolesCatalog } from "@entities/user";
import { dyn } from "@shared/i18n/dyn";
import { ChoiceCard, DialogFooter, DialogSection, FieldError, ToggleRow } from "./shared/DialogParts";
import PolicySentence from "./shared/PolicySentence";
import { useConditionValue } from "./shared/useConditionValue";
import { ROLE_TONES, roleTone } from "./shared/tokens";

const OPERATORS_WITHOUT_VALUE = new Set(["is_empty", "is_not_empty"]);
/** Referencias al usuario que se pueden usar como valor (SoD, área, rol). */
const USER_REFERENCES = ["@user.id", "@user.departmentId", "@user.role"];

/** Operadores que tienen sentido para cada tipo de campo. */
const OPERATORS_BY_TYPE: Record<PolicyFieldDef["type"], string[]> = {
  number: ["gt", "gte", "lt", "lte", "eq", "neq"],
  enum: ["eq", "neq"],
  user: ["eq", "neq", "is_empty", "is_not_empty"],
  string: ["eq", "neq", "in", "not_in", "is_empty", "is_not_empty"],
  boolean: ["eq", "neq"],
};

interface FormState {
  name: string;
  description: string;
  action: string;
  effect: PolicyEffect;
  priority: string;
  priorityTouched: boolean;
  active: boolean;
  allRoles: boolean;
  roles: string[];
  conditions: PolicyCondition[];
}

export interface PolicySubmit {
  mode: "create" | "update";
  id?: string;
  payload: {
    name: string;
    description?: string;
    action: string;
    effect: PolicyEffect;
    priority: number;
    active: boolean;
    roles: string[];
    conditions: PolicyCondition[];
  };
}

interface Props {
  isOpen: boolean;
  policy: PolicyAdmin | null;
  actions: PolicyActionDef[];
  /** Políticas existentes: el orden de una regla nueva va después de las de su acción. */
  policies: readonly PolicyAdmin[];
  /** Acción precargada al crear desde la tarjeta de una acción. */
  initialAction?: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (submit: PolicySubmit) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

/**
 * Asistente de reglas ABAC en lenguaje simple: para qué acción, qué pasa
 * (negar o permitir), cuándo (condiciones sobre el registro) y a quién aplica,
 * con la regla leída en voz alta antes de guardar.
 */
export default function PolicyEditorDialog({
  isOpen,
  policy,
  actions,
  policies,
  initialAction = null,
  saving,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useTranslation(["roles", "common"]);
  const tt = dyn(t);
  const valueText = useConditionValue();
  const rolesCatalog = useRolesCatalog();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<{ conditions?: string }>({});
  const [showMore, setShowMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nextPriority = useMemo(
    () => (action: string) => {
      const used = policies.filter((item) => item.action === action).map((item) => item.priority);
      return used.length ? Math.max(...used) + 10 : 100;
    },
    [policies]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (policy) {
      setForm({
        name: policy.name,
        description: policy.description ?? "",
        action: policy.action,
        effect: policy.effect,
        priority: String(policy.priority),
        priorityTouched: true,
        active: policy.active,
        allRoles: policy.roles.length === 0,
        roles: [...policy.roles],
        conditions: policy.conditions.map((condition) => ({ ...condition })),
      });
    } else {
      const action = initialAction ?? actions[0]?.key ?? "";
      setForm({
        name: "",
        description: "",
        action,
        effect: "DENY",
        priority: String(nextPriority(action)),
        priorityTouched: false,
        active: true,
        allRoles: true,
        roles: [],
        conditions: [],
      });
    }
    setErrors({});
    setShowMore(false);
    setConfirmDelete(false);
  }, [isOpen, policy, actions, initialAction, nextPriority]);

  if (!form) return null;

  const action = actions.find((item) => item.key === form.action);
  const fieldOf = (key: string) => action?.fields.find((field) => field.key === key);
  const update = (patch: Partial<FormState>) => setForm((previous) => (previous ? { ...previous, ...patch } : previous));

  const setCondition = (index: number, patch: Partial<PolicyCondition>) =>
    update({ conditions: form.conditions.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const addCondition = () => {
    const field = action?.fields[0];
    if (!field) return;
    update({ conditions: [...form.conditions, { field: field.key, operator: OPERATORS_BY_TYPE[field.type][0], value: "" }] });
  };

  const changeAction = (key: string) =>
    update({
      action: key,
      conditions: [],
      ...(form.priorityTouched ? {} : { priority: String(nextPriority(key)) }),
    });

  const toggleRole = (role: string) =>
    update({ roles: form.roles.includes(role) ? form.roles.filter((item) => item !== role) : [...form.roles, role] });

  const roles = form.allRoles ? [] : form.roles;
  const suggestedName = `${t(`policies.effect.${form.effect}`)}: ${action?.label ?? form.action}${
    form.conditions.length
      ? ` — ${form.conditions
          .map((item) => `${fieldOf(item.field)?.label ?? item.field} ${tt(`policies.operator.${item.operator}`)} ${valueText(item.value)}`.trim())
          .join(", ")}`
      : ""
  }`.slice(0, 120);

  const handleSave = async () => {
    const invalid = form.conditions.some(
      (item) => !item.field || (!OPERATORS_WITHOUT_VALUE.has(item.operator) && (item.value ?? "") === "")
    );
    if (invalid) {
      setErrors({ conditions: t("policies.errors.condition") });
      return;
    }
    if (!form.allRoles && form.roles.length === 0) {
      setErrors({ conditions: t("policies.errors.roles") });
      return;
    }
    setErrors({});
    const payload: PolicySubmit["payload"] = {
      name: form.name.trim() || suggestedName,
      description: form.description.trim() || undefined,
      action: form.action,
      effect: form.effect,
      priority: Number(form.priority) || 0,
      active: form.active,
      roles,
      conditions: form.conditions.map((item) => ({
        field: item.field,
        operator: item.operator,
        value: OPERATORS_WITHOUT_VALUE.has(item.operator) ? null : item.value,
      })),
    };
    const ok = policy ? await onSubmit({ mode: "update", id: policy.id, payload }) : await onSubmit({ mode: "create", payload });
    if (ok) onClose();
  };

  const handleDelete = async () => {
    if (!policy) return;
    const ok = await onDelete(policy.id);
    if (ok) onClose();
  };

  const valueInput = (condition: PolicyCondition, index: number) => {
    const field = fieldOf(condition.field);
    if (!field || OPERATORS_WITHOUT_VALUE.has(condition.operator)) return null;
    if (field.type === "enum" || field.type === "user" || field.type === "boolean") {
      const options =
        field.type === "enum"
          ? (field.options ?? []).map((option) => ({ value: option, label: option }))
          : field.type === "user"
            ? USER_REFERENCES.map((reference) => ({ value: reference, label: valueText(reference) }))
            : [
                { value: "true", label: t("simulator.yes") },
                { value: "false", label: t("simulator.no") },
              ];
      return (
        <div className="w-44">
          <ITSelect
            name={`cond_value_${index}`}
            size="sm"
            options={[{ value: "", label: t("policies.pickValue") }, ...options]}
            value={condition.value ?? ""}
            onChange={(event) => setCondition(index, { value: event.target.value })}
          />
        </div>
      );
    }
    return (
      <div className="w-32">
        <ITInput
          name={`cond_value_${index}`}
          size="sm"
          type={field.type === "number" ? "number" : "text"}
          placeholder={field.type === "number" ? "10000" : ""}
          value={condition.value ?? ""}
          onChange={(event) => setCondition(index, { value: event.target.value })}
        />
      </div>
    );
  };

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={onClose}
      title={policy ? t("policies.editTitle") : t("policies.newTitle")}
      useFormHeader
    >
      <ITStack spacing={4}>
        <DialogSection step={1} title={t("policies.wizard.action")} hint={t("policies.wizard.actionHint")}>
          <ITSelect
            name="policy_action"
            size="sm"
            options={actions.map((item) => ({ value: item.key, label: `${item.label} · ${item.module}` }))}
            value={form.action}
            onChange={(event) => changeAction(event.target.value)}
          />
        </DialogSection>

        <DialogSection step={2} title={t("policies.wizard.effect")}>
          <div className="grid gap-2 sm:!grid-cols-2">
            <ChoiceCard
              tone="danger"
              selected={form.effect === "DENY"}
              onClick={() => update({ effect: "DENY" })}
              icon={<FaBan size={10} className="text-rose-500" />}
              title={t("policies.wizard.deny")}
              description={t("policies.wizard.denyHint")}
            />
            <ChoiceCard
              tone="success"
              selected={form.effect === "ALLOW"}
              onClick={() => update({ effect: "ALLOW" })}
              icon={<FaCheckCircle size={10} className="text-emerald-500" />}
              title={t("policies.wizard.allow")}
              description={t("policies.wizard.allowHint")}
            />
          </div>
        </DialogSection>

        <DialogSection step={3} title={t("policies.wizard.when")} hint={t("policies.wizard.whenHint")}>
          <ITStack spacing={2}>
            {form.conditions.length === 0 && (
              <ITText className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{t("policies.noConditions")}</ITText>
            )}
            {form.conditions.map((condition, index) => {
              const field = fieldOf(condition.field);
              const operators = OPERATORS_BY_TYPE[field?.type ?? "string"];
              return (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                  <ITText as="span" className="w-6 text-[10px] font-black text-slate-400">
                    {index === 0 ? t("policies.if") : t("policies.and")}
                  </ITText>
                  <div className="w-40">
                    <ITSelect
                      name={`cond_field_${index}`}
                      size="sm"
                      options={(action?.fields ?? []).map((item) => ({ value: item.key, label: item.label }))}
                      value={condition.field}
                      onChange={(event) => {
                        const next = fieldOf(event.target.value);
                        setCondition(index, {
                          field: event.target.value,
                          operator: OPERATORS_BY_TYPE[next?.type ?? "string"][0],
                          value: "",
                        });
                      }}
                    />
                  </div>
                  <div className="w-40">
                    <ITSelect
                      name={`cond_op_${index}`}
                      size="sm"
                      options={operators.map((operator) => ({ value: operator, label: tt(`policies.operator.${operator}`) }))}
                      value={condition.operator}
                      onChange={(event) =>
                        setCondition(index, {
                          operator: event.target.value,
                          value: OPERATORS_WITHOUT_VALUE.has(event.target.value) ? "" : condition.value,
                        })
                      }
                    />
                  </div>
                  {valueInput(condition, index)}
                  <button
                    type="button"
                    onClick={() => update({ conditions: form.conditions.filter((_, i) => i !== index) })}
                    className="ml-auto flex h-6 w-6 items-center justify-center rounded-md !bg-transparent text-slate-400 hover:!bg-rose-50 hover:text-rose-600"
                    title={t("policies.removeCondition")}
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addCondition}
              className="flex w-fit items-center gap-1.5 !bg-transparent text-[11px] font-bold text-primary-500 hover:underline"
            >
              <FaPlus size={9} /> {t("policies.addCondition")}
            </button>
            <FieldError message={errors.conditions} />
          </ITStack>
        </DialogSection>

        <DialogSection step={4} title={t("policies.wizard.who")}>
          <div className="grid gap-2 sm:!grid-cols-2">
            <ChoiceCard
              selected={form.allRoles}
              onClick={() => update({ allRoles: true })}
              title={t("policies.wizard.everyone")}
              description={t("policies.wizard.everyoneHint")}
            />
            <ChoiceCard
              selected={!form.allRoles}
              onClick={() => update({ allRoles: false })}
              title={t("policies.wizard.someRoles")}
              description={t("policies.wizard.someRolesHint")}
            />
          </div>
          {!form.allRoles && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rolesCatalog
                .filter((role) => role.active)
                .map((role) => {
                  const selected = form.roles.includes(role.key);
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => toggleRole(role.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                        selected ? "border-primary-500 !bg-primary-500 text-white" : "border-slate-200 !bg-[var(--it-card-bg)] text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${selected ? "bg-[var(--it-card-bg)]" : ROLE_TONES[roleTone(role.key)].dot}`} />
                      {role.name}
                    </button>
                  );
                })}
            </div>
          )}
        </DialogSection>

        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 px-3 py-2">
          <ITText className="mb-1 text-[12px] font-semibold text-primary-500">{t("policies.wizard.preview")}</ITText>
          <PolicySentence policy={{ effect: form.effect, roles, conditions: form.conditions }} action={action} />
        </div>

        <DialogSection title={t("policies.wizard.name")} hint={t("policies.wizard.nameHint")}>
          <ITInput
            name="policy_name"
            size="sm"
            placeholder={suggestedName}
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </DialogSection>

        <div>
          <button
            type="button"
            onClick={() => setShowMore((open) => !open)}
            className="flex items-center gap-1.5 !bg-transparent text-[11px] font-bold text-slate-500 hover:text-slate-700"
          >
            {showMore ? <FaChevronDown size={8} /> : <FaChevronRight size={8} />}
            {t("roleDialog.moreOptions")}
          </button>
          {showMore && (
            <div className="mt-2 flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
              <ITTextarea
                name="policy_description"
                label={t("policies.fields.description")}
                rows={2}
                value={form.description}
                onChange={(value) => update({ description: value })}
              />
              <div>
                <ITInput
                  name="policy_priority"
                  type="number"
                  size="sm"
                  label={t("policies.wizard.order")}
                  value={form.priority}
                  onChange={(event) => update({ priority: event.target.value, priorityTouched: true })}
                />
                <ITText className="mt-1 text-[10px] text-slate-400">{t("policies.priorityHint")}</ITText>
              </div>
              <ToggleRow
                checked={form.active}
                onChange={(active) => update({ active })}
                title={t("policies.fields.active")}
                description={t("policies.wizard.activeHint")}
              />
            </div>
          )}
        </div>

        <DialogFooter
          left={
            policy && !policy.key ? (
              confirmDelete ? (
                <ITText as="span" className="flex items-center gap-2">
                  <ITText as="span" className="text-[11px] text-rose-600">{t("policies.deleteConfirm", { name: policy.name })}</ITText>
                  <ITButton variant="filled" color="danger" size="sm" disabled={saving} onClick={handleDelete}>
                    <ITText as="span" className="text-[11px] font-bold">{t("policies.deleteTitle")}</ITText>
                  </ITButton>
                  <ITButton variant="outlined" color="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                    <ITText as="span" className="text-[11px] font-bold">{t("common:actions.cancel")}</ITText>
                  </ITButton>
                </ITText>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 !bg-transparent text-[11px] font-bold text-rose-600 hover:underline"
                >
                  <FaTrash size={9} /> {t("policies.deleteTitle")}
                </button>
              )
            ) : undefined
          }
        >
          <ITButton variant="outlined" color="secondary" onClick={onClose}>
            <ITText as="span" className="text-[11px] font-bold">{t("common:actions.cancel")}</ITText>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={handleSave} disabled={saving}>
            <ITText as="span" className="text-[11px] font-bold">{saving ? t("policies.saving") : t("policies.save")}</ITText>
          </ITButton>
        </DialogFooter>
      </ITStack>
    </ITDialog>
  );
}
