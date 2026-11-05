import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FaFingerprint, FaIdCard, FaSyncAlt, FaUserCheck, FaUserSlash } from "react-icons/fa";
import { ITButton, ITDataTable, ITDialog, ITFlex, ITSearchSelect, ITText } from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { useTimeClockPeople } from "../model/useTimeClockPeople";
import PersonDetailDialog from "./PersonDetailDialog";
import { timeClockApi, type TimeClockPerson } from "@entities/time-clock";
import { useCan } from "@entities/user";

/** Persona con su presencia de rostro y huellas (null mientras se leen los conteos). */
type Row = TimeClockPerson & { faces: number | null; fingerprints: number | null };
const yesNo = (n: number | null): string | null => (n === null ? null : n > 0 ? "true" : "false");
const TOTAL_CHECKS = 3;

interface Props {
  /** Reloj elegido por el panel o el dashboard; si viene, no se muestra selector. */
  clockSerial?: string;
}

/** Foto de la persona si tiene rostro registrado; si no, un Blobatar. Libera la URL al salir. */
function PersonAvatar({ clockSerial, employeeNumber, name, hasFace }: { clockSerial: string; employeeNumber: string; name: string; hasFace: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!hasFace || !clockSerial) return;
    let url: string | null = null;
    let cancelled = false;
    timeClockApi
      .personPhoto(clockSerial, employeeNumber)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setSrc(null);
    };
  }, [clockSerial, employeeNumber, hasFace]);
  return <ProfileAvatar photoUrl={src} name={name} size="md" alt={name} />;
}

function Chip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <ITText as="span"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-dashed border-slate-300 text-slate-500"
      }`}
    >
      {icon}
      {label}
    </ITText>
  );
}

/** Personas del reloj en tabla: foto, presencia de rostro/huella/tarjeta y avance. Clic en la fila abre la ficha. */
export default function TimeClockPeopleView({ clockSerial }: Props) {
  const { t } = useTranslation("time-clock");
  const fx = useTimeClockPeople(clockSerial);
  const controlled = clockSerial !== undefined;
  const canWrite = useCan("time_clock.write");
  const [removing, setRemoving] = useState<TimeClockPerson | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const navigate = useNavigate();
  // Ficha unificada: con usuario vinculado se abre su pantalla de empleado; si no, la ficha del reloj.
  const openFicha = (row: Row) => (row.userId ? navigate(`/employees/${row.userId}`) : setViewing(row.employeeNumber));

  const rows: Row[] = useMemo(() => {
    const bio = fx.biometrics?.people ?? {};
    return (fx.data?.people ?? [])
      .map((p) => ({
        ...p,
        faces: bio[p.employeeNumber]?.faces ?? null,
        fingerprints: bio[p.employeeNumber]?.fingerprints ?? null,
      }))
      .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber, "es", { numeric: true }));
  }, [fx.data, fx.biometrics]);

  const fetchData = useMemo(
    () =>
      makeClientTableFetch<Row>(async () => rows, {
        faces: { value: (r) => yesNo(r.faces), match: "equals" },
        fingerprints: { value: (r) => yesNo(r.fingerprints), match: "equals" },
        cards: { value: (r) => yesNo(r.cards.length), match: "equals" },
      }),
    [rows]
  );

  const yesNoOptions = [
    { id: "true", name: t("people.table.yes") },
    { id: "false", name: t("people.table.no") },
  ];
  const progressOf = (r: Row) => [(r.faces ?? 0) > 0, (r.fingerprints ?? 0) > 0, r.cards.length > 0].filter(Boolean).length;

  const columns: Column<Row>[] = [
    {
      key: "name",
      type: "string",
      label: t("people.view.columns.person"),
      width: "34%",
      filter: true,
      sortable: true,
      render: (row) => (
        <ITFlex align="center" gap={3}>
          <PersonAvatar clockSerial={fx.serial} employeeNumber={row.employeeNumber} name={row.name} hasFace={(row.faces ?? 0) > 0} />
          <ITFlex className="min-w-0">
            <ITText className="truncate font-semibold text-slate-900">{row.name}</ITText>
            <ITText className="font-mono text-xs text-slate-500">#{row.employeeNumber}</ITText>
          </ITFlex>
        </ITFlex>
      ),
    },
    { key: "employeeNumber", type: "string", label: t("people.table.number"), width: 130, filter: true, sortable: true },
    {
      key: "faces",
      type: "catalog",
      label: t("people.view.chips.face"),
      width: 130,
      filter: "catalog",
      catalogOptions: { data: yesNoOptions },
      sortable: true,
      render: (row) => <Chip on={(row.faces ?? 0) > 0} icon={<FaUserCheck size={10} />} label={t("people.view.chips.face")} />,
    },
    {
      key: "fingerprints",
      type: "catalog",
      label: t("people.view.chips.fingerprint"),
      width: 130,
      filter: "catalog",
      catalogOptions: { data: yesNoOptions },
      sortable: true,
      render: (row) => <Chip on={(row.fingerprints ?? 0) > 0} icon={<FaFingerprint size={10} />} label={t("people.view.chips.fingerprint")} />,
    },
    {
      key: "cards",
      type: "catalog",
      label: t("people.view.chips.card"),
      width: 130,
      filter: "catalog",
      catalogOptions: { data: yesNoOptions },
      sortable: true,
      render: (row) => <Chip on={row.cards.length > 0} icon={<FaIdCard size={10} />} label={t("people.view.chips.card")} />,
    },
    {
      key: "progress",
      type: "number",
      label: t("people.view.columns.progress"),
      width: 150,
      render: (row) => {
        const done = progressOf(row);
        return (
          <div className="w-28">
            <ITText className="text-xs text-slate-500">{t("people.view.progress", { done, total: TOTAL_CHECKS })}</ITText>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / TOTAL_CHECKS) * 100}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      type: "actions",
      label: "",
      width: 190,
      pinned: "right",
      actions: (row) => (
        <ITFlex align="center" justify="end" gap={2}>
          <ITButton variant="raised-text" color="primary" size="sm" onClick={() => openFicha(row)}>
            {t("people.actions.view")}
          </ITButton>
          {canWrite && (
            <ITButton variant="outlined" color="danger" size="sm" disabled={fx.busy} onClick={() => setRemoving(row)}>
              {t("people.actions.remove")}
            </ITButton>
          )}
        </ITFlex>
      ),
    },
  ];

  const confirmRemove = async () => {
    if (!removing) return;
    if (await fx.remove(removing.employeeNumber)) setRemoving(null);
  };

  return (
    <div className={`flex flex-col gap-4 ${controlled ? "" : "p-6"}`}>
      <ITFlex align="end" justify="between" gap={3} wrap="wrap">
        <ITText className="text-sm text-slate-500">{t("people.view.count", { count: rows.length })}</ITText>
        <ITFlex align="end" gap={3} wrap="wrap">
          {!controlled && (
            <ITSearchSelect
              name="timeClockPeopleClock"
              label={t("people.clock")}
              options={fx.devices.map((d) => ({ value: d.clockSerial, label: d.name }))}
              value={fx.serial}
              onChange={(value) => fx.setSerial(String(value))}
              className="min-w-[220px]"
            />
          )}
          <ITButton
            variant="outlined"
            color="secondary"
            size="sm"
            disabled={fx.loading || fx.busy || fx.biometricsLoading}
            onClick={() => {
              fx.reload();
              fx.reloadBiometrics();
            }}
          >
            <ITFlex align="center" gap={2}>
              <FaSyncAlt size={11} className={fx.loading || fx.biometricsLoading ? "animate-spin" : ""} />
              {t("people.view.refreshAll")}
            </ITFlex>
          </ITButton>
        </ITFlex>
      </ITFlex>

      {fx.error && <ITText role="alert" className="text-sm text-red-600">{fx.error}</ITText>}
      {fx.biometricsError && <ITText role="alert" className="text-sm text-red-600">{fx.biometricsError}</ITText>}
      {fx.toast && <ITText role="status" className="text-sm text-emerald-700" onClick={fx.dismissToast}>{fx.toast}</ITText>}

      <ITDataTable showViewToggle={false}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        fetchData={
          fetchData as unknown as (p: ITDataTableFetchParams) => Promise<ITDataTableResponse<Record<string, unknown>>>
        }
        reloadTrigger={`${fx.version}-${fx.biometrics?.updatedAt ?? ""}`}
        debounceMs={350}
        variant="bordered"
        onRowClick={(row) => openFicha(row as unknown as Row)}
        defaultItemsPerPage={25}
        itemsPerPageOptions={[25, 50, 100]}
        layout="fixed"
        density="compact"
        rowHeight={50}
        virtualized
        virtualizedMaxHeight={460}
      />

      {viewing && (
        <PersonDetailDialog
          clockSerial={fx.serial}
          employeeNumber={viewing}
          editable={canWrite}
          onChanged={fx.reload}
          onClose={() => setViewing(null)}
        />
      )}

      <ITDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={t("people.confirm.title", { name: removing?.name ?? "" })}
        className="max-w-md"
      >
        <ITFlex direction="column" gap={4} className="mt-2">
          <ITText className="text-sm text-slate-600">
            {t("people.confirm.body", { name: removing?.name ?? "", number: removing?.employeeNumber ?? "" })}
          </ITText>
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => setRemoving(null)}>
              {t("people.actions.no")}
            </ITButton>
            <ITButton variant="filled" color="danger" disabled={fx.busy} onClick={() => void confirmRemove()}>
              <ITFlex align="center" gap={2}>
                <FaUserSlash size={12} />
                {t("people.confirm.action")}
              </ITFlex>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>
    </div>
  );
}
