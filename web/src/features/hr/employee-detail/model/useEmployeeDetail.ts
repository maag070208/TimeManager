import { useCallback, useEffect, useState } from "react";
import { i18n } from "@shared/i18n";
import { personalApi } from "@entities/hr";
import type {
  PersonalProfile,
  PersonalProfileUpdateInput,
  EmployeeDiscount,
  EmployeeDocument,
  DocumentType,
  Gender,
  BloodType,
} from "@entities/hr";
import { usersApi, useCan } from "@entities/user";
import { describeClockSync, timeClockApi } from "@entities/time-clock";

/** Baja o alta en los relojes. Un fallo del reloj no revierte la baja o el alta de la persona en el sistema. */
const clockSync = async (run: () => Promise<{ results: Parameters<typeof describeClockSync>[0] }>, action: "baja" | "alta") => {
  try {
    const { results } = await run();
    return describeClockSync(results, action);
  } catch {
    return i18n.t("time-clock:clockSync.failed", { clock: "reloj" });
  }
};

export const useEmployeeDetail = (id: string | undefined) => {
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [bloodTypes, setBloodTypes] = useState<BloodType[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canWriteClock = useCan("time_clock.write");
  /** Qué pasó en los relojes tras dar de baja o de alta a la persona. */
  const [clockNotice, setClockNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [uploadingDocTypeId, setUploadingDocTypeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, docs, types, genders, bloods] = await Promise.all([
        personalApi.get(id),
        personalApi.documents(id),
        personalApi.documentTypes(),
        personalApi.genders(),
        personalApi.bloodTypes(),
      ]);
      setProfile(p);
      setDocuments(docs);
      setDocumentTypes(types);
      setGenders(genders);
      setBloodTypes(bloods);
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.loadError"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadPhoto = async (file: File) => {
    if (!id) return;
    setError(null);
    try {
      const { photoUrl } = await personalApi.uploadPhoto(id, file);
      setProfile((p) => (p ? { ...p, photoUrl } : p));
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.photoUploadError"));
    }
  };

  const uploadDocument = async (documentTypeId: string, file: File): Promise<boolean> => {
    if (!id) return false;
    setError(null);
    try {
      const doc = await personalApi.uploadDocument(id, documentTypeId, file);
      setDocuments((current) => [doc, ...current]);
      return true;
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.documentUploadError"));
      return false;
    }
  };

  const removeDocument = async (docId: string) => {
    if (!id) return;
    setError(null);
    try {
      await personalApi.removeDocument(id, docId);
      setDocuments((current) => current.filter((d) => d.id !== docId));
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.documentDeleteError"));
    }
  };

  const saveProfile = async (data: PersonalProfileUpdateInput, discounts: EmployeeDiscount[]) => {
    if (!id) return false;
    setSaving(true);
    setError(null);
    try {
      await personalApi.updateProfile(id, data);
      const updated = await personalApi.setDiscounts(id, discounts);
      setProfile(updated);
      setEditOpen(false);
      return true;
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.saveError"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async (reason: string) => {
    if (!id) return;
    setError(null);
    try {
      await usersApi.deactivate(id, { reason, notifyUser: true });
      setClockNotice(canWriteClock ? await clockSync(() => timeClockApi.employeeClockBajaAll(id), "baja") : null);
      setProfile((p) =>
        p
          ? {
              ...p,
              active: false,
              deactivatedAt: new Date().toISOString(),
              deactivationReason: reason,
            }
          : p
      );
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.deactivateError"));
    } finally {
      setDeactivateOpen(false);
    }
  };

  const reactivate = async () => {
    if (!id) return;
    setError(null);
    try {
      await usersApi.reactivate(id);
      setClockNotice(canWriteClock ? await clockSync(() => timeClockApi.employeeClockAltaAll(id), "alta") : null);
      setProfile((p) => (p ? { ...p, active: true } : p));
    } catch (e: any) {
      setError(e.message ?? i18n.t("employees:detail.reactivateError"));
    }
  };

  return {
    clockNotice,
    dismissClockNotice: () => setClockNotice(null),
    profile,
    documents,
    documentTypes,
    genders,
    bloodTypes,
    loading,
    saving,
    error,
    setError,
    editOpen,
    setEditOpen,
    deactivateOpen,
    setDeactivateOpen,
    uploadingDocTypeId,
    setUploadingDocTypeId,
    uploadPhoto,
    uploadDocument,
    removeDocument,
    saveProfile,
    confirmDeactivate,
    reactivate,
  };
};
