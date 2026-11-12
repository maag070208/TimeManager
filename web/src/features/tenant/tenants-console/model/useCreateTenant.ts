import { useEffect, useState } from "react";
import { planApi, type Plan } from "@entities/plan";
import { tenantApi, type TenantCreated } from "@entities/tenant";
import { DEFAULT_PUNCH_CHANNELS, type PunchChannel } from "@shared/lib/punch-channels";
import { generatePassword, isCommonUsername, isValidSlug, MX_TIMEZONES, slugify } from "./slug";

interface Form {
  name: string;
  slug: string;
  timezone: string;
  planId: string;
  employeeLimit: string;
  punchChannels: PunchChannel[];
  adminName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
}

const EMPTY: Form = {
  name: "",
  slug: "",
  timezone: MX_TIMEZONES[0],
  planId: "",
  employeeLimit: "",
  punchChannels: [...DEFAULT_PUNCH_CHANNELS],
  adminName: "",
  adminUsername: "",
  adminEmail: "",
  adminPassword: "",
};

export type CreateTenantField = keyof Form;
type Errors = Partial<Record<CreateTenantField, string>>;

/** "María José Pérez" → "maria.perez": nombre y último apellido, sin acentos. */
const usernameFrom = (name: string): string => {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 1 ? `${words[0]}.${words[words.length - 1]}` : words[0] ?? "";
};

const validate = (form: Form): Errors => {
  const e: Errors = {};
  if (form.name.trim().length < 2) e.name = "required";
  if (!isValidSlug(form.slug)) e.slug = "slug";
  if (form.employeeLimit && !(Number.parseInt(form.employeeLimit, 10) > 0)) e.employeeLimit = "number";
  if (form.adminName.trim().length < 2) e.adminName = "required";
  if (form.adminUsername.trim().length < 3) e.adminUsername = "username";
  else if (isCommonUsername(form.adminUsername)) e.adminUsername = "commonUsername";
  if (form.adminEmail && !/^\S+@\S+\.\S+$/.test(form.adminEmail.trim())) e.adminEmail = "email";
  if (form.adminPassword.length < 12 || form.adminPassword.length > 128) e.adminPassword = "password";
  return e;
};

/**
 * Alta de cliente: empresa y subdominio, plan y su administrador. El subdominio
 * y el usuario se proponen solos a partir de los nombres hasta que se editan a
 * mano, y la contraseña inicial llega generada (se puede escribir otra). Al
 * terminar deja los datos de acceso para mostrarlos una sola vez.
 */
export const useCreateTenant = () => {
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, adminPassword: generatePassword() }));
  const [slugTouched, setSlugTouched] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [created, setCreated] = useState<TenantCreated | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    let alive = true;
    planApi
      .list()
      .then((rows) => alive && setPlans(rows.filter((plan) => plan.active)))
      .catch(() => alive && setPlans([]));
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends CreateTenantField>(key: K, value: Form[K]) => {
    if (key === "adminUsername") setUsernameTouched(true);
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      if (key === "adminName" && !usernameTouched) next.adminUsername = usernameFrom(String(value));
      return next;
    });
    setErrors((e) => {
      if (!e[key] && !(key === "name" && e.slug) && !(key === "adminName" && e.adminUsername)) return e;
      const next = { ...e };
      delete next[key];
      if (key === "name" && !slugTouched) delete next.slug;
      if (key === "adminName" && !usernameTouched) delete next.adminUsername;
      return next;
    });
  };

  const setSlug = (value: string) => {
    setSlugTouched(true);
    set("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  /** Alterna un canal de checada; nunca deja la lista vacía (mínimo uno). */
  const toggleChannel = (channel: PunchChannel) => {
    setForm((f) => {
      const has = f.punchChannels.includes(channel);
      if (has && f.punchChannels.length === 1) return f;
      return {
        ...f,
        punchChannels: has ? f.punchChannels.filter((item) => item !== channel) : [...f.punchChannels, channel],
      };
    });
  };

  const live = validate(form);
  /** Secciones completas (sin errores y con lo obligatorio capturado), para las palomitas y el avance. */
  const complete = {
    company: !live.name && !live.slug,
    plan: !live.employeeLimit,
    admin: !live.adminName && !live.adminUsername && !live.adminEmail && !live.adminPassword,
  };

  /** Crea el cliente; si algo falta devuelve el primer campo con error para llevar el foco ahí. */
  const submit = async (): Promise<CreateTenantField | null> => {
    setErrors(live);
    const first = (Object.keys(EMPTY) as CreateTenantField[]).find((key) => live[key]);
    if (first) return first;
    setSaving(true);
    setApiError(null);
    try {
      setCreated(
        await tenantApi.create({
          name: form.name.trim(),
          slug: form.slug,
          timezone: form.timezone,
          planId: form.planId || null,
          employeeLimit: form.employeeLimit ? Number.parseInt(form.employeeLimit, 10) : null,
          punchChannels: form.punchChannels,
          admin: {
            name: form.adminName.trim(),
            username: form.adminUsername.trim(),
            email: form.adminEmail.trim() || null,
            password: form.adminPassword,
          },
        })
      );
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
    return null;
  };

  const reset = () => {
    setForm({ ...EMPTY, adminPassword: generatePassword() });
    setSlugTouched(false);
    setUsernameTouched(false);
    setErrors({});
    setApiError(null);
    setCreated(null);
  };

  return { form, set, setSlug, toggleChannel, errors, complete, saving, apiError, setApiError, created, plans, submit, reset };
};
