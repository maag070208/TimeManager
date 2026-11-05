import { useEffect, useState } from "react";
import { ITButton, ITCheckbox, ITDialog, ITInput, ITTextarea, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { CatalogCreateDto, CatalogUpdateDto, PermissionCatalog } from "@entities/permission";
import type { PermissionScope } from "@entities/user";
import { ChoiceCard, DialogFooter, DialogSection, FieldError, SuggestionChips, ToggleRow } from "./shared/DialogParts";

const SCOPE_ORDER: PermissionScope[] = ["NONE", "OWN", "AREA", "ALL"];
const KEY_REGEX = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** Formas habituales de alcance; cualquier otra combinación es "personalizado". */
const PRESETS = {
  yesNo: ["NONE", "ALL"],
  ownAreaAll: ["OWN", "AREA", "ALL"],
  areaAll: ["AREA", "ALL"],
} as const satisfies Record<string, readonly PermissionScope[]>;

type Preset = keyof typeof PRESETS | "custom";

const presetOf = (scopes: readonly PermissionScope[]): Preset => {
  const sorted = SCOPE_ORDER.filter((scope) => scopes.includes(scope)).join(",");
  for (const [preset, list] of Object.entries(PRESETS)) {
    if (list.join(",") === sorted) return preset as Preset;
  }
  return "custom";
};

interface FormState {
  key: string;
  module: string;
  name: string;
  description: string;
  scopes: PermissionScope[];
  sensitive: boolean;
  sortOrder: string;
}

export type PermissionSubmit =
  | { mode: "create"; dto: CatalogCreateDto }
  | { mode: "update"; key: string; dto: CatalogUpdateDto };

interface Props {
  isOpen: boolean;
  /** Permiso en edición; `null` = alta. */
  permission: PermissionCatalog | null;
  /** Módulos existentes, para sugerirlos. */
  modules: readonly string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (submit: PermissionSubmit) => Promise<boolean>;
}

const blank = (): FormState => ({
  key: "",
  module: "",
  name: "",
  description: "",
  scopes: [...PRESETS.yesNo],
  sensitive: false,
  sortOrder: "0",
});

/** Alta y edición de un permiso del catálogo, en pasos y con lenguaje simple. */
export default function PermissionFormDialog({ isOpen, permission, modules, saving, error, onClose, onSubmit }: Props) {
  const { t } = useTranslation(["roles", "common"]);
  const [form, setForm] = useState<FormState>(blank);
  const [preset, setPreset] = useState<Preset>("yesNo");
  const [errors, setErrors] = useState<Partial<Record<"key" | "module" | "name" | "scopes" | "sortOrder", string>>>({});
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const next = permission
      ? {
          key: permission.key,
          module: permission.module,
          name: permission.name,
          description: permission.description ?? "",
          scopes: [...permission.scopes],
          sensitive: permission.sensitive,
          sortOrder: String(permission.sortOrder),
        }
      : blank();
    setForm(next);
    setPreset(presetOf(next.scopes));
    setErrors({});
    setShowMore(false);
  }, [isOpen, permission]);

  const update = (patch: Partial<FormState>) => setForm((previous) => ({ ...previous, ...patch }));

  const choosePreset = (value: Preset) => {
    setPreset(value);
    if (value !== "custom") update({ scopes: [...PRESETS[value]] });
  };

  const toggleScope = (scope: PermissionScope, checked: boolean) =>
    update({
      scopes: checked
        ? SCOPE_ORDER.filter((item) => item === scope || form.scopes.includes(item))
        : form.scopes.filter((item) => item !== scope),
    });

  const handleSave = async () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = t("catalog.errors.name");
    if (!form.module.trim()) next.module = t("catalog.errors.module");
    if (!permission && !KEY_REGEX.test(form.key.trim())) next.key = t("catalog.errors.key");
    if (form.scopes.length === 0) next.scopes = t("catalog.errors.scopes");
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) next.sortOrder = t("catalog.errors.sortOrder");
    setErrors(next);
    if (next.key || next.sortOrder) setShowMore(true);
    if (Object.keys(next).length > 0) return;

    const ok = permission
      ? await onSubmit({
          mode: "update",
          key: permission.key,
          dto: {
            module: form.module.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            scopes: form.scopes,
            sensitive: form.sensitive,
            sortOrder,
          },
        })
      : await onSubmit({
          mode: "create",
          dto: {
            key: form.key.trim(),
            module: form.module.trim(),
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            scopes: form.scopes,
            sensitive: form.sensitive,
            sortOrder,
          },
        });
    if (ok) onClose();
  };

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={onClose}
      title={permission ? t("catalog.editTitle") : t("catalog.createTitle")}
      useFormHeader
    >
      <ITStack spacing={4}>
        {error && <ITText className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</ITText>}

        <DialogSection step={1} title={t("catalog.wizard.name")} hint={t("catalog.wizard.nameHint")}>
          <ITInput
            name="permission_name"
            autoFocus
            placeholder={t("catalog.wizard.namePlaceholder")}
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
          <FieldError message={errors.name} />
          <div className="mt-2">
            <ITTextarea
              name="permission_description"
              rows={2}
              placeholder={t("catalog.wizard.descriptionPlaceholder")}
              value={form.description}
              onChange={(value) => update({ description: value })}
            />
          </div>
        </DialogSection>

        <DialogSection step={2} title={t("catalog.wizard.module")}>
          <ITInput
            name="permission_module"
            placeholder={t("catalog.wizard.modulePlaceholder")}
            value={form.module}
            onChange={(event) => update({ module: event.target.value })}
          />
          <SuggestionChips options={modules} value={form.module} onPick={(module) => update({ module })} />
          <FieldError message={errors.module} />
        </DialogSection>

        <DialogSection step={3} title={t("catalog.wizard.scope")} hint={t("catalog.wizard.scopeHint")}>
          <div className="grid gap-2">
            <ChoiceCard
              selected={preset === "yesNo"}
              onClick={() => choosePreset("yesNo")}
              title={t("catalog.wizard.yesNo")}
              description={t("catalog.wizard.yesNoHint")}
            />
            <ChoiceCard
              selected={preset === "ownAreaAll"}
              onClick={() => choosePreset("ownAreaAll")}
              title={t("catalog.wizard.ownAreaAll")}
              description={t("catalog.wizard.ownAreaAllHint")}
            />
            <ChoiceCard
              selected={preset === "areaAll"}
              onClick={() => choosePreset("areaAll")}
              title={t("catalog.wizard.areaAll")}
              description={t("catalog.wizard.areaAllHint")}
            />
            <ChoiceCard
              selected={preset === "custom"}
              onClick={() => choosePreset("custom")}
              title={t("catalog.wizard.custom")}
            />
          </div>
          {preset === "custom" && (
            <div className="mt-2 flex flex-wrap gap-4 rounded-lg bg-slate-50 px-3 py-2">
              {SCOPE_ORDER.map((scope) => (
                <ITCheckbox
                  key={scope}
                  name={`scope_${scope}`}
                  checked={form.scopes.includes(scope)}
                  onChange={(checked) => toggleScope(scope, checked)}
                  label={t(`scope.${scope}`)}
                />
              ))}
            </div>
          )}
          <FieldError message={errors.scopes} />
        </DialogSection>

        <ToggleRow
          checked={form.sensitive}
          onChange={(sensitive) => update({ sensitive })}
          title={t("catalog.wizard.sensitive")}
          description={t("catalog.wizard.sensitiveHint")}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowMore((open) => !open)}
            className="flex items-center gap-1.5 !bg-transparent text-[11px] font-bold text-slate-500 hover:text-slate-700"
          >
            {showMore || !permission ? <FaChevronDown size={8} /> : <FaChevronRight size={8} />}
            {t("catalog.wizard.technical")}
          </button>
          {(showMore || !permission) && (
            <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 sm:!grid-cols-2">
              <div>
                <ITInput
                  name="permission_key"
                  label={t("catalog.fields.key")}
                  placeholder="reports.export"
                  value={form.key}
                  disabled={!!permission}
                  onChange={(event) => update({ key: event.target.value.toLowerCase() })}
                />
                <FieldError message={errors.key} />
                <ITText className="mt-1 text-[10px] text-slate-400">{t("catalog.wizard.keyHint")}</ITText>
              </div>
              <div>
                <ITInput
                  name="permission_sortOrder"
                  type="number"
                  label={t("catalog.fields.sortOrder")}
                  value={form.sortOrder}
                  onChange={(event) => update({ sortOrder: event.target.value })}
                />
                <FieldError message={errors.sortOrder} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <ITButton variant="outlined" color="secondary" onClick={onClose}>
            <ITText as="span" className="text-[11px] font-bold">{t("common:actions.cancel")}</ITText>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={handleSave} disabled={saving}>
            <ITText as="span" className="text-[11px] font-bold">
              {saving ? t("catalog.saving") : permission ? t("roleDialog.saveChanges") : t("catalog.wizard.create")}
            </ITText>
          </ITButton>
        </DialogFooter>
      </ITStack>
    </ITDialog>
  );
}
