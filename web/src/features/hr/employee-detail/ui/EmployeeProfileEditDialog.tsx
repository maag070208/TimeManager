import { useEffect, useState } from "react";
import {
  ITButton,
  ITCheckbox,
  ITDatePicker,
  ITDialog,
  ITFlex,
  ITInput,
  ITSelect,
  ITTabs,
  ITText,
  ITTextarea,
} from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import type {
  PersonalProfile,
  PersonalProfileUpdateInput,
  EmployeeDiscount,
  DiscountType,
  Gender,
  BloodType,
} from "@entities/hr";
import {
  validateCurp,
  validateEmail,
  validateNss,
  validatePhone,
  validatePostal,
  validateRfc,
} from "@shared/validation";

const DISCOUNT_TYPES: DiscountType[] = ["INFONAVIT", "IMSS", "CHILD_SUPPORT"];

/** "YYYY-MM-DD" <-> Date local (sin pasar por UTC, para no correr el día). */
const dateStrToLocal = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const localToDateStr = (value: Date): string => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

type FormState = PersonalProfileUpdateInput;

const emptyForm = (): FormState => ({});

const formFromProfile = (p: PersonalProfile): FormState => ({
  middleName: p.middleName ?? "",
  paternalSurname: p.paternalSurname ?? "",
  maternalSurname: p.maternalSurname ?? "",
  email: p.email ?? "",
  genderId: p.gender?.id ?? "",
  bloodTypeId: p.bloodType?.id ?? "",
  medicalConditions: p.medicalConditions ?? "",
  allergies: p.allergies ?? "",
  birthDate: p.birthDate ?? "",
  hireDate: p.hireDate ?? "",
  rfc: p.rfc ?? "",
  curp: p.curp ?? "",
  nss: p.nss ?? "",
  streetAddress: p.streetAddress ?? "",
  neighborhood: p.neighborhood ?? "",
  postalCode: p.postalCode ?? "",
  city: p.city ?? "",
  addressState: p.addressState ?? "",
  country: p.country ?? "México",
  personalPhone: p.personalPhone ?? "",
  workPhone: p.workPhone ?? "",
  emergencyContactName: p.emergencyContactName ?? "",
  emergencyContactPhone: p.emergencyContactPhone ?? "",
  emergencyContactRelationship: p.emergencyContactRelationship ?? "",
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: PersonalProfile | null;
  genders: Gender[];
  bloodTypes: BloodType[];
  saving: boolean;
  onSave: (data: PersonalProfileUpdateInput, discounts: EmployeeDiscount[]) => Promise<boolean>;
}

export default function EmployeeProfileEditDialog({
  isOpen,
  onClose,
  profile,
  genders,
  bloodTypes,
  saving,
  onSave,
}: Props) {
  const { t: tt } = useTranslation(["employees", "common"]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discounts, setDiscounts] = useState<Record<DiscountType, string | null>>({
    INFONAVIT: null,
    IMSS: null,
    CHILD_SUPPORT: null,
  });

  useEffect(() => {
    if (!isOpen || !profile) return;
    setForm(formFromProfile(profile));
    const next: Record<DiscountType, string | null> = {
      INFONAVIT: null,
      IMSS: null,
      CHILD_SUPPORT: null,
    };
    for (const d of profile.discounts) next[d.type] = d.note ?? "";
    setDiscounts(next);
  }, [isOpen, profile]);

  const field = (name: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const dateField = (name: "birthDate" | "hireDate") => (
    e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: Date | [Date | null, Date | null] } }
  ) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [name]: value instanceof Date ? localToDateStr(value) : "" }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const rfcErr = validateRfc(form.rfc);
    if (rfcErr) e.rfc = rfcErr;
    const curpErr = validateCurp(form.curp);
    if (curpErr) e.curp = curpErr;
    const nssErr = validateNss(form.nss);
    if (nssErr) e.nss = nssErr;
    const postalErr = validatePostal(form.postalCode);
    if (postalErr) e.postalCode = postalErr;
    const personalPhoneErr = validatePhone(form.personalPhone);
    if (personalPhoneErr) e.personalPhone = personalPhoneErr;
    const companyPhoneErr = validatePhone(form.workPhone);
    if (companyPhoneErr) e.workPhone = companyPhoneErr;
    const emergencyPhoneErr = validatePhone(form.emergencyContactPhone);
    if (emergencyPhoneErr) e.emergencyContactPhone = emergencyPhoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) e.email = emailErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    // Campos de texto vacíos se normalizan a null (en vez de "") para que
    // limpien el valor en vez de fallar validaciones de formato (p.ej. email).
    const normalized: FormState = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? null : value])
    ) as FormState;
    const discountList: EmployeeDiscount[] = DISCOUNT_TYPES.filter((t) => discounts[t] !== null).map((t) => ({
      type: t,
      note: discounts[t] || undefined,
    }));
    await onSave(normalized, discountList);
  };

  const personalTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[200px]">
          <ITInput name="middleName" label={tt("detail.fields.secondName")} value={form.middleName ?? ""} onChange={field("middleName")} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="paternalSurname" label={tt("detail.fields.paternalSurname")} value={form.paternalSurname ?? ""} onChange={field("paternalSurname")} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="maternalSurname" label={tt("detail.fields.maternalSurname")} value={form.maternalSurname ?? ""} onChange={field("maternalSurname")} />
        </div>
      </ITFlex>
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[200px]">
          <ITSelect
            name="genderId"
            label={tt("detail.fields.gender")}
            value={form.genderId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, genderId: e.target.value }))}
            options={[{ value: "", label: "—" }, ...genders.map((g) => ({ value: g.id, label: g.name }))]}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITDatePicker name="birthDate" label={tt("detail.fields.birthDate")} value={dateStrToLocal(form.birthDate)} onChange={dateField("birthDate")} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITDatePicker name="hireDate" label={tt("detail.fields.hireDate")} value={dateStrToLocal(form.hireDate)} onChange={dateField("hireDate")} />
        </div>
      </ITFlex>
    </ITFlex>
  );

  const officialTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[200px]">
          <ITInput name="rfc" label={tt("detail.fields.rfc")} value={form.rfc ?? ""} onChange={field("rfc")} aria-invalid={!!errors.rfc} />
          {errors.rfc && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.rfc}</ITText>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="curp" label={tt("detail.fields.curp")} value={form.curp ?? ""} onChange={field("curp")} aria-invalid={!!errors.curp} />
          {errors.curp && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.curp}</ITText>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="nss" label={tt("detail.fields.nss")} value={form.nss ?? ""} onChange={field("nss")} aria-invalid={!!errors.nss} />
          {errors.nss && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.nss}</ITText>}
        </div>
      </ITFlex>
    </ITFlex>
  );

  const addressTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      <ITInput name="streetAddress" label={tt("detail.fields.street")} value={form.streetAddress ?? ""} onChange={field("streetAddress")} />
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[160px]">
          <ITInput name="neighborhood" label={tt("detail.fields.colony")} value={form.neighborhood ?? ""} onChange={field("neighborhood")} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <ITInput name="postalCode" label={tt("detail.fields.zip")} value={form.postalCode ?? ""} onChange={field("postalCode")} aria-invalid={!!errors.postalCode} />
          {errors.postalCode && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.postalCode}</ITText>}
        </div>
      </ITFlex>
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[160px]">
          <ITInput name="city" label={tt("detail.fields.city")} value={form.city ?? ""} onChange={field("city")} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <ITInput name="addressState" label={tt("detail.fields.state")} value={form.addressState ?? ""} onChange={field("addressState")} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <ITInput name="country" label={tt("detail.fields.country")} value={form.country ?? ""} onChange={field("country")} />
        </div>
      </ITFlex>
    </ITFlex>
  );

  const contactTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[200px]">
          <ITInput name="personalPhone" label={tt("detail.fields.personalCell")} value={form.personalPhone ?? ""} onChange={field("personalPhone")} aria-invalid={!!errors.personalPhone} />
          {errors.personalPhone && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.personalPhone}</ITText>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="workPhone" label={tt("detail.fields.companyCell")} value={form.workPhone ?? ""} onChange={field("workPhone")} aria-invalid={!!errors.workPhone} />
          {errors.workPhone && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.workPhone}</ITText>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="email" type="email" label={tt("detail.fields.email")} value={form.email ?? ""} onChange={field("email")} aria-invalid={!!errors.email} />
          {errors.email && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.email}</ITText>}
        </div>
      </ITFlex>
      <ITText className="text-[12px] font-semibold text-slate-400 pt-2">
        {tt("detail.emergencyContactTitle")}
      </ITText>
      <ITFlex gap={4} wrap="wrap">
        <div className="flex-1 min-w-[200px]">
          <ITInput name="emergencyContactName" label={tt("detail.fields.emergencyContact")} value={form.emergencyContactName ?? ""} onChange={field("emergencyContactName")} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="emergencyContactPhone" label={tt("detail.fields.emergencyPhone")} value={form.emergencyContactPhone ?? ""} onChange={field("emergencyContactPhone")} aria-invalid={!!errors.emergencyContactPhone} />
          {errors.emergencyContactPhone && <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">{errors.emergencyContactPhone}</ITText>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <ITInput name="emergencyContactRelationship" label={tt("detail.fields.emergencyRelation")} value={form.emergencyContactRelationship ?? ""} onChange={field("emergencyContactRelationship")} />
        </div>
      </ITFlex>
    </ITFlex>
  );

  const medicalTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      <div className="max-w-xs">
        <ITSelect
          name="bloodTypeId"
          label={tt("detail.fields.bloodType")}
          value={form.bloodTypeId ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, bloodTypeId: e.target.value }))}
          options={[{ value: "", label: "—" }, ...bloodTypes.map((b) => ({ value: b.id, label: b.name }))]}
        />
      </div>
      <ITTextarea
        name="medicalConditions"
        label={tt("detail.fields.condition")}
        value={form.medicalConditions ?? ""}
        onChange={(value) => setForm((f) => ({ ...f, medicalConditions: value }))}
        rows={2}
      />
      <ITTextarea
        name="allergies"
        label={tt("detail.fields.allergies")}
        value={form.allergies ?? ""}
        onChange={(value) => setForm((f) => ({ ...f, allergies: value }))}
        rows={2}
      />
    </ITFlex>
  );

  const discountsTab = (
    <ITFlex direction="column" gap={4} className="pt-4">
      {DISCOUNT_TYPES.map((type) => {
        const checked = discounts[type] !== null;
        return (
          <div key={type} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <ITCheckbox
              name={`discount_${type}`}
              checked={checked}
              onChange={(value) =>
                setDiscounts((d) => ({ ...d, [type]: value ? "" : null }))
              }
              label={<ITText className="text-[12px] font-bold text-slate-700">{tt(`detail.discountTypes.${type}`)}</ITText>}
            />
            {checked && (
              <div className="mt-2">
                <ITInput
                  name={`discount_note_${type}`}
                  label={tt("detail.discountNote")}
                  value={discounts[type] ?? ""}
                  onChange={(e) => setDiscounts((d) => ({ ...d, [type]: e.target.value }))}
                />
              </div>
            )}
          </div>
        );
      })}
    </ITFlex>
  );

  return (
    <ITDialog isOpen={isOpen} onClose={onClose} title={tt("detail.editInfo")} className="max-w-3xl">
      <ITTabs
        variant="line"
        items={[
          { id: "personal", label: tt("detail.tabs.personal"), content: personalTab },
          { id: "official", label: tt("detail.tabs.official"), content: officialTab },
          { id: "address", label: tt("detail.tabs.address"), content: addressTab },
          { id: "contact", label: tt("detail.tabs.contact"), content: contactTab },
          { id: "medical", label: tt("detail.tabs.medical"), content: medicalTab },
          { id: "discounts", label: tt("detail.tabs.discounts"), content: discountsTab },
        ]}
      />
      <ITFlex justify="end" gap={2} className="mt-6 pt-4 border-t border-slate-100">
        <ITButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          <ITText className="font-bold text-[11px]">{tt("common:actions.cancel")}</ITText>
        </ITButton>
        <ITButton variant="filled" color="primary" onClick={handleSave} disabled={saving}>
          <ITText className="font-bold text-[11px]">{saving ? tt("detail.saving") : tt("common:actions.save")}</ITText>
        </ITButton>
      </ITFlex>
    </ITDialog>
  );
}
