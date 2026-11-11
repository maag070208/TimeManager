import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITDialog, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { tenantApi, type Tenant } from "@entities/tenant";
import { tenantHost } from "@shared/api/tenant";
import { isValidSlug, MX_TIMEZONES } from "../model/slug";

interface Props {
  isOpen: boolean;
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: (tenant: Tenant) => void;
}

const tzLabel = (tz: string) => tz.replace("America/", "").replace(/_/g, " ");

/** Edita nombre, zona horaria y subdominio del cliente; si cambia el subdominio, la dirección anterior deja de funcionar. */
export default function TenantEditDialog({ isOpen, tenant, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ name: "", timezone: "", slug: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tenant) {
      setForm({ name: tenant.name, timezone: tenant.timezone, slug: tenant.slug });
      setError(null);
    }
  }, [isOpen, tenant]);

  if (!tenant) return null;
  const name = form.name.trim();
  const validName = name.length >= 2 && name.length <= 120;
  const validSlug = isValidSlug(form.slug);
  const changes = {
    ...(name !== tenant.name && { name }),
    ...(form.timezone !== tenant.timezone && { timezone: form.timezone }),
    ...(form.slug !== tenant.slug && { slug: form.slug }),
  };
  const changed = Object.keys(changes).length > 0;
  const timezones = MX_TIMEZONES.includes(tenant.timezone as (typeof MX_TIMEZONES)[number]) ? [...MX_TIMEZONES] : [tenant.timezone, ...MX_TIMEZONES];

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await tenantApi.update(tenant.id, changes));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ITDialog isOpen={isOpen} onClose={onClose} title="Editar cliente">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (validName && validSlug && changed && !saving) void save();
        }}
      >
        {error && <ITAlert variant="error">{error}</ITAlert>}
        <ITInput
          name="tenantName"
          label="Nombre"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          error={!validName ? "Entre 2 y 120 caracteres." : undefined}
          touched={!validName}
          required
          autoFocus
        />
        <ITSearchSelect
          name="tenantTimezone"
          label="Zona horaria"
          options={timezones.map((tz) => ({ value: tz, label: tzLabel(tz) }))}
          value={form.timezone}
          onChange={(event) => setForm((prev) => ({ ...prev, timezone: String(event.target.value) }))}
        />
        <div>
          <ITInput
            name="tenantSlug"
            label="Subdominio"
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
            error={!validSlug ? "Usa minúsculas, números y guiones; no puede ser una palabra reservada." : undefined}
            touched={!validSlug}
            required
          />
          <ITText className="mt-1 block text-xs text-slate-500">
            Su personal entra por <strong>{validSlug ? tenantHost(form.slug) : "…"}</strong>
          </ITText>
        </div>
        {changes.slug && (
          <ITAlert variant="warning">
            La dirección actual ({tenantHost(tenant.slug)}) dejará de funcionar de inmediato. Avisa al cliente: sus enlaces
            guardados y los de correos anteriores ya no abrirán. Usuarios, contraseñas y datos no cambian.
          </ITAlert>
        )}
        <div className="flex justify-end gap-2">
          <ITButton type="button" variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </ITButton>
          <ITButton type="submit" variant="filled" color="primary" disabled={!validName || !validSlug || !changed || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </ITButton>
        </div>
      </form>
    </ITDialog>
  );
}
