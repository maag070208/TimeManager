import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { dashboardApi, type RecordGapsRow } from "@entities/dashboard";
import { personalApi, type EmployeeDocument } from "@entities/hr";
import { dyn } from "@shared/i18n/dyn";

/** Estado del expediente: falta algún obligatorio, falta algo más, o completo. */
export type RecordStatus = "REQUIRED" | "INCOMPLETE" | "COMPLETE";
export type RecordFilter = "ALL" | RecordStatus;

export const recordStatus = (r: RecordGapsRow): RecordStatus =>
  r.missingRequired.length > 0 ? "REQUIRED" : r.missingDocuments.length || r.missingFields.length ? "INCOMPLETE" : "COMPLETE";

type Toast = { message: string; type: "success" | "error" };

/**
 * Tablero de expedientes (RH): lista filtrable con el estado de cada
 * expediente y el detalle de la persona elegida, con sus documentos para
 * verlos o subir los que faltan, y los avisos (uno o masivo).
 */
export const useEmployeeRecords = () => {
  const { t: tt } = useTranslation("employees");
  const t = dyn(tt);
  const [rows, setRows] = useState<RecordGapsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecordFilter>("ALL");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardApi
      .hrRecords()
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setError(null);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const byStatus = { REQUIRED: 0, INCOMPLETE: 0, COMPLETE: 0 };
    for (const r of rows) byStatus[recordStatus(r)] += 1;
    return { total: rows.length, ...byStatus };
  }, [rows]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.departmentId) map.set(r.departmentId, r.departmentName ?? "—");
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => filter === "ALL" || recordStatus(r) === filter)
      .filter((r) => !departmentId || r.departmentId === departmentId)
      .filter((r) => !q || [r.name, r.employeeNumber, r.departmentName].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [rows, filter, departmentId, search]);

  // La persona elegida (por defecto la primera de la lista visible).
  const selected = useMemo(
    () => visible.find((r) => r.userId === selectedId) ?? visible[0] ?? null,
    [visible, selectedId]
  );

  const loadDocuments = useCallback((userId: string) => {
    personalApi
      .documents(userId)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  useEffect(() => {
    setDocuments([]);
    if (selected) loadDocuments(selected.userId);
  }, [selected?.userId, loadDocuments]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Último archivo entregado de un tipo de documento (para "Ver"). */
  const documentOf = (typeId: string) =>
    documents.filter((d) => d.documentTypeId === typeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  const upload = async (typeId: string, file: File) => {
    if (!selected) return;
    setUploading(typeId);
    try {
      await personalApi.uploadDocument(selected.userId, typeId, file);
      setToast({ message: t("records.detail.uploaded"), type: "success" });
      loadDocuments(selected.userId);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t("records.detail.uploadError"), type: "error" });
    } finally {
      setUploading(null);
    }
  };

  const notify = async (row: RecordGapsRow) => {
    setNotifying(row.userId);
    try {
      const res = await dashboardApi.notifyMissingRecords(row.userId);
      setToast({ message: t(res.emailed ? "records.notifiedEmail" : "records.notified", { name: row.name }), type: "success" });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t("records.notifyError"), type: "error" });
    } finally {
      setNotifying(null);
    }
  };

  /** Pendientes de la lista visible (lo que se avisa con "Avisar a pendientes"). */
  const pendingVisible = visible.filter((r) => recordStatus(r) !== "COMPLETE");

  const notifyPending = async () => {
    setBulkSending(true);
    try {
      const res = await dashboardApi.notifyMissingRecordsBulk(pendingVisible.map((r) => r.userId));
      setToast({ message: t("records.notifyPendingDone", { notified: res.notified, emailed: res.emailed }), type: "success" });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t("records.notifyError"), type: "error" });
    } finally {
      setBulkSending(false);
      setBulkOpen(false);
    }
  };

  return {
    t,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
    counts,
    departments,
    search,
    setSearch,
    filter,
    setFilter,
    departmentId,
    setDepartmentId,
    visible,
    selected,
    select: setSelectedId,
    documentOf,
    upload,
    uploading,
    notify,
    notifying,
    pendingVisible,
    bulkOpen,
    setBulkOpen,
    bulkSending,
    notifyPending,
    toast,
    setToast,
  };
};

export type UseEmployeeRecords = ReturnType<typeof useEmployeeRecords>;
