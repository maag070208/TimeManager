import { useState } from "react";
import { planApi, type Plan } from "@entities/plan";

interface Form {
  name: string;
  employeeLimit: string;
  clockLimit: string;
  monthlyPrice: string;
}

const EMPTY: Form = { name: "", employeeLimit: "", clockLimit: "", monthlyPrice: "" };

const fromPlan = (plan: Plan | null): Form =>
  plan
    ? {
        name: plan.name,
        employeeLimit: String(plan.employeeLimit),
        clockLimit: String(plan.clockLimit),
        monthlyPrice: plan.monthlyPrice ? String(Number(plan.monthlyPrice)) : "",
      }
    : EMPTY;

type Errors = Partial<Record<keyof Form, string>>;

/** Alta y edición de un plan del catálogo (la clave la deriva el API del nombre). */
export const usePlanForm = (plan: Plan | null, onSaved: () => void) => {
  const [form, setForm] = useState<Form>(() => fromPlan(plan));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "required";
    const people = Number.parseInt(form.employeeLimit, 10);
    if (!(people >= 1)) e.employeeLimit = "positive";
    const clocks = Number.parseInt(form.clockLimit, 10);
    if (!(clocks >= 1)) e.clockLimit = "positive";
    if (form.monthlyPrice !== "") {
      const price = Number(form.monthlyPrice);
      if (!Number.isFinite(price) || price < 0) e.monthlyPrice = "price";
    }
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setApiError(null);
    try {
      const payload = {
        name: form.name.trim(),
        employeeLimit: Number.parseInt(form.employeeLimit, 10),
        clockLimit: Number.parseInt(form.clockLimit, 10),
        monthlyPrice: form.monthlyPrice === "" ? null : Number(form.monthlyPrice),
      };
      if (plan) await planApi.update(plan.id, payload);
      else await planApi.create(payload);
      onSaved();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return { form, set, errors, saving, apiError, submit };
};
