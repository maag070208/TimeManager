import { useEffect, useMemo, useState } from "react";
import { ITButton, ITDialog, ITInput, ITSelect, ITTextarea, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { FaChevronDown, FaChevronRight, FaClone, FaLock, FaRegFile } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { RoleAdmin, RoleCreateDto, RoleUpdateDto } from "@entities/permission";
import { ROLE_KEY_REGEX, roleKeyFromName } from "../model/role-key";
import { ChoiceCard, DialogFooter, DialogSection, FieldError, SuggestionChips, ToggleRow } from "./shared/DialogParts";

export type RoleSubmit =
  | { mode: "create"; dto: RoleCreateDto }
  | { mode: "update"; key: string; dto: RoleUpdateDto };

type Start = "blank" | "copy";

interface FormState {
  name: string;
  key: string;
  /** La clave se escribió a mano: ya no se recalcula con el nombre. */
  keyTouched: boolean;
  description: string;
  module: string;
  staff: boolean;
  sortOrder: string;
  start: Start;
  copyFrom: string;
}

interface Props {
  isOpen: boolean;
  /** Rol en edición; `null` = alta. */
  role: RoleAdmin | null;
  /** Duplicar: el alta arranca copiando los permisos de este rol. */
  copyFrom?: RoleAdmin | null;
  /** Todos los roles (para copiar permisos, sugerir grupos y no repetir claves). */
  roles: readonly RoleAdmin[];
  permissionCountOf: (role: string) => number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: RoleSubmit) => Promise<boolean>;
}

const blank = (): FormState => ({
  name: "",
  key: "",
  keyTouched: false,
  description: "",
  module: "",
  staff: false,
  sortOrder: "0",
  start: "blank",
  copyFrom: "",
});

/**
 * Alta y edición de un rol en lenguaje simple: primero el nombre (la clave
 * interna se genera sola), para qué es, en qué grupo va y con qué permisos
 * empieza (de cero o copiando otro rol). Activar, desactivar y eliminar están
 * en el menú ⋯ del rol, no aquí.
 */
export default function RoleEditorDialog({
  isOpen,
  role,
  copyFrom = null,
  roles,
  permissionCountOf,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useTranslation(["roles", "common"]);
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<{ name?: string; key?: string; copy?: string }>({});
  const [showMore, setShowMore] = useState(false);

  const editing = role !== null;
  const takenKeys = useMemo(() => roles.map((item) => item.key), [roles]);
  const groups = useMemo(
    () => [...new Set(roles.map((item) => item.module?.trim()).filter((value): value is string => !!value))],
    [roles]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (role) {
      setForm({
        ...blank(),
        name: role.name,
        key: role.key,
        keyTouched: true,
        description: role.description ?? "",
        module: role.module ?? "",
        staff: role.staff,
        sortOrder: String(role.sortOrder),
      });
    } else if (copyFrom) {
      const name = t("roleDialog.copyName", { name: copyFrom.name });
      setForm({
        ...blank(),
        name,
        key: roleKeyFromName(name, takenKeys),
        description: copyFrom.description ?? "",
        module: copyFrom.module ?? "",
        staff: copyFrom.staff,
        start: "copy",
        copyFrom: copyFrom.key,
      });
    } else {
      setForm(blank());
    }
    setErrors({});
    setShowMore(false);
  }, [isOpen, role, copyFrom, takenKeys, t]);

  const setName = (name: string) =>
    setForm((previous) => ({
      ...previous,
      name,
      key: previous.keyTouched ? previous.key : roleKeyFromName(name, takenKeys),
    }));

  const dirty =
    !editing ||
    form.name.trim() !== role.name ||
    form.description.trim() !== (role.description ?? "") ||
    form.module.trim() !== (role.module ?? "") ||
    form.staff !== role.staff ||
    (Number(form.sortOrder) || 0) !== role.sortOrder;

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = t("roleDialog.errors.name");
    if (!editing) {
      if (!ROLE_KEY_REGEX.test(form.key)) next.key = t("roleDialog.errors.key");
      else if (takenKeys.includes(form.key)) next.key = t("roleDialog.errors.keyTaken");
      if (form.start === "copy" && !form.copyFrom) next.copy = t("roleDialog.errors.copy");
    }
    setErrors(next);
    if (next.key) setShowMore(true);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const description = form.description.trim();
    const module = form.module.trim();
    const sortOrder = Number(form.sortOrder) || 0;
    const ok = editing
      ? await onSubmit({
          mode: "update",
          key: role.key,
          dto: {
            ...(role.system ? {} : { name: form.name.trim() }),
            description: description || null,
            module: module || null,
            staff: form.staff,
            sortOrder,
          },
        })
      : await onSubmit({
          mode: "create",
          dto: {
            key: form.key,
            name: form.name.trim(),
            ...(description && { description }),
            ...(module && { module }),
            staff: form.staff,
            sortOrder,
            ...(form.start === "copy" && form.copyFrom ? { copyFrom: form.copyFrom } : {}),
          },
        });
    if (ok) onClose();
  };

  const copyOptions = roles.map((item) => ({
    value: item.key,
    label: t("roleDialog.copyOption", { name: item.name, count: permissionCountOf(item.key) }),
  }));

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("roleDialog.editTitle") : copyFrom ? t("roleDialog.duplicateTitle") : t("roleDialog.newTitle")}
      useFormHeader
    >
      <ITStack spacing={4}>
        <DialogSection step={editing ? undefined : 1} title={t("roleDialog.nameQuestion")} hint={t("roleDialog.nameHint")}>
          <ITInput
            name="role_name"
            autoFocus
            placeholder={t("roleDialog.namePlaceholder")}
            value={form.name}
            disabled={editing && role.system}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError message={errors.name} />
          {editing && role.system && (
            <ITText className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
              <FaLock size={8} /> {t("roleDialog.systemLocked")}
            </ITText>
          )}
          {!editing && form.key && (
            <ITText className="mt-1 text-[10px] text-slate-400">
              {t("roleDialog.keyPreview")} <ITText as="span" className="font-mono font-bold text-slate-500">{form.key}</ITText>
            </ITText>
          )}
        </DialogSection>

        <DialogSection step={editing ? undefined : 2} title={t("roleDialog.descriptionQuestion")}>
          <ITTextarea
            name="role_description"
            rows={2}
            placeholder={t("roleDialog.descriptionPlaceholder")}
            value={form.description}
            onChange={(value) => setForm((previous) => ({ ...previous, description: value }))}
          />
        </DialogSection>

        {!editing && (
          <DialogSection step={3} title={t("roleDialog.startQuestion")}>
            <div className="grid gap-2 sm:!grid-cols-2">
              <ChoiceCard
                selected={form.start === "blank"}
                onClick={() => setForm((previous) => ({ ...previous, start: "blank" }))}
                icon={<FaRegFile size={10} />}
                title={t("roleDialog.startBlank")}
                description={t("roleDialog.startBlankHint")}
              />
              <ChoiceCard
                selected={form.start === "copy"}
                onClick={() => setForm((previous) => ({ ...previous, start: "copy" }))}
                icon={<FaClone size={10} />}
                title={t("roleDialog.startCopy")}
                description={t("roleDialog.startCopyHint")}
              />
            </div>
            {form.start === "copy" && (
              <div className="mt-2">
                <ITSelect
                  name="role_copy_from"
                  size="sm"
                  placeholder={t("roleDialog.copyPlaceholder")}
                  options={[{ value: "", label: t("roleDialog.copyPlaceholder") }, ...copyOptions]}
                  value={form.copyFrom}
                  onChange={(event) => setForm((previous) => ({ ...previous, copyFrom: event.target.value }))}
                />
                <FieldError message={errors.copy} />
              </div>
            )}
          </DialogSection>
        )}

        <DialogSection step={editing ? undefined : 4} title={t("roleDialog.groupQuestion")} hint={t("roleDialog.groupHint")}>
          <ITInput
            name="role_module"
            placeholder={t("roleDialog.groupPlaceholder")}
            value={form.module}
            onChange={(event) => setForm((previous) => ({ ...previous, module: event.target.value }))}
          />
          <SuggestionChips
            options={groups}
            value={form.module}
            onPick={(module) => setForm((previous) => ({ ...previous, module }))}
          />
        </DialogSection>

        <ToggleRow
          checked={form.staff}
          onChange={(staff) => setForm((previous) => ({ ...previous, staff }))}
          title={t("roleDialog.staff")}
          description={t("roleDialog.staffHint")}
        />

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
            <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 sm:!grid-cols-2">
              <div>
                <ITInput
                  name="role_key"
                  label={t("roleDialog.key")}
                  value={form.key}
                  disabled={editing}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, key: event.target.value.toUpperCase(), keyTouched: true }))
                  }
                />
                <FieldError message={errors.key} />
                <ITText className="mt-1 text-[10px] text-slate-400">{t("roleDialog.keyHint")}</ITText>
              </div>
              <div>
                <ITInput
                  name="role_sortOrder"
                  type="number"
                  label={t("roleDialog.order")}
                  value={form.sortOrder}
                  onChange={(event) => setForm((previous) => ({ ...previous, sortOrder: event.target.value }))}
                />
                <ITText className="mt-1 text-[10px] text-slate-400">{t("roleDialog.orderHint")}</ITText>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <ITButton variant="outlined" color="secondary" onClick={onClose}>
            <ITText as="span" className="text-[11px] font-bold">{t("roleDialog.cancel")}</ITText>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={handleSave} disabled={saving || !dirty}>
            <ITText as="span" className="text-[11px] font-bold">
              {saving ? t("roleDialog.saving") : editing ? t("roleDialog.saveChanges") : t("roleDialog.create")}
            </ITText>
          </ITButton>
        </DialogFooter>
      </ITStack>
    </ITDialog>
  );
}
