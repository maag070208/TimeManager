import { useEffect, useState } from "react";
import { planApi, type Plan } from "@entities/plan";
import { tenantApi, type TenantCreated } from "@entities/tenant";
import { isValidSlug, MX_TIMEZONES, slugify } from "./slug";

interface Form {
  name: string;
  slug: string;
  timezone: string;
  planId: string;
  employeeLimit: string;
  adminName: string;
  adminUsername: string;
  adminEmail: string;
}

const EMPTY: Form = {
  name: "",
  slug: "",
  timezone: MX_TIMEZONES[0],
  planId: "",
  employeeLimit: "",
  adminName: "",
  adminUsername: "admin",
  adminEmail: "",
};

type Errors = Partial<Record<keyof Form, string>>;

/** Alta guiada de cliente: tenant + su administrador; al terminar muestra la contraseña provisional una vez. */
export const useCreateTenant = (onCreated: () => void) => {
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [created, setCreated] = useState<TenantCreated | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    let alive = true;
    planApi
      .list()
      .then((rows) => alive && setPlans(rows))
      .catch(() => alive && setPlans([]));
    return () => {
      alive = false;
    };
  }, []);

  const set = (key: keyof Form, value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(value);
      return next;
    });

  const setSlug = (value: string) => {
    setSlugTouched(true);
    setForm((f) => ({ ...f, slug: value.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "required";
    if (!isValidSlug(form.slug)) e.slug = "slug";
    if (form.adminName.trim().length < 2) e.adminName = "required";
    if (form.adminUsername.trim().length < 3) e.adminUsername = "username";
    if (form.adminEmail && !/^\S+@\S+\.\S+$/.test(form.adminEmail.trim())) e.adminEmail = "email";
    if (form.employeeLimit && !(Number.parseInt(form.employeeLimit, 10) > 0)) e.employeeLimit = "number";
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setApiError(null);
    try {
      const result = await tenantApi.create({
        name: form.name.trim(),
        slug: form.slug,
        timezone: form.timezone,
        planId: form.planId || null,
        employeeLimit: form.employeeLimit ? Number.parseInt(form.employeeLimit, 10) : null,
        admin: {
          name: form.adminName.trim(),
          username: form.adminUsername.trim(),
          email: form.adminEmail.trim() || null,
        },
      });
      setCreated(result);
      onCreated();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setSlugTouched(false);
    setErrors({});
    setApiError(null);
    setCreated(null);
  };

  return { form, set, setSlug, errors, saving, apiError, created, plans, submit, reset };
};
