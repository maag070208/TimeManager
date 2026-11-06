import { useCallback, useEffect, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITDataTable,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  ITToast,
  type Column,
  type ITDataTableFetchParams,
  type ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { LuBookOpen, LuPlus } from "react-icons/lu";
import { nomApi, type LeaveType } from "@entities/nom";
import { HelpTip } from "@shared/ui/help-tip";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";

/** Catálogos del cliente: tipos de permiso y, más adelante, el resto de catálogos maestros. */
export default function CatalogsPage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [paid, setPaid] = useState("false");

  const load = useCallback(async () => {
    try {
      setTypes(await nomApi.leaveTypes());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los catálogos.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createType = async () => {
    if (key.trim().length < 3 || name.trim().length < 3) return;
    setSaving(true);
    try {
      await nomApi.createType({ key: key.trim().toUpperCase(), name: name.trim(), paid: paid === "true" });
      setToast("Tipo de permiso agregado.");
      setKey("");
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el tipo.");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<LeaveType>[] = [
    {
      key: "name",
      label: "Nombre",
      type: "string",
      render: (row) => <ITText className="font-semibold !text-[12px]">{row.name}</ITText>,
    },
    {
      key: "key",
      label: "Clave",
      type: "string",
      width: 220,
      render: (row) => <span className="font-mono text-[11.5px] text-slate-500">{row.key}</span>,
    },
    {
      key: "paid",
      label: "Goce de sueldo",
      type: "string",
      width: 190,
      render: (row) => <ITBadget color={row.paid ? "success" : "gray"} size="sm">{row.paid ? "Con goce" : "Sin goce"}</ITBadget>,
    },
  ];

  const fetchTypes = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<LeaveType>> => {
    const start = (params.page - 1) * params.limit;
    return { data: types.slice(start, start + params.limit), total: types.length };
  };

  return (
    <ITPage
      title="Catálogos"
      description="Datos maestros que usan vacaciones, expedientes y nómina. Se administran por cliente."
      icon={<LuBookOpen size={20} />}
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        <BentoKpiGrid
          items={[
            { id: "types", label: "Tipos de permiso", value: types.length, caption: "configurados", icon: <LuBookOpen size={14} />, tone: "info" },
            { id: "paid", label: "Con goce", value: types.filter((type) => type.paid).length, caption: "pagan el día", tone: "success" },
            { id: "unpaid", label: "Sin goce", value: types.filter((type) => !type.paid).length, caption: "no pagan el día", tone: "warning" },
          ]}
        />

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <ITCard className="tm-hero-card tm-hero-card--sky lg:col-span-8" contentClassName="!p-5">
            <ITFlex align="center" gap={2}>
              <ITText className="font-bold">Tipos de permiso</ITText>
              <HelpTip text="Definen qué puede solicitar el personal. 'Con goce' paga el día; 'sin goce' no. La aprobación de RH viaja a la prenómina." />
            </ITFlex>
            <div className="mt-3">
              <ITDataTable
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                fetchData={fetchTypes as never}
                showViewToggle={false}
                defaultItemsPerPage={50}
                itemsPerPageOptions={[25, 50, 100]}
                layout="fixed"
                density="compact"
                virtualized
                virtualizedMaxHeight={400}
                rowHeight={50}
              />
            </div>
          </ITCard>

          <ITCard className="tm-hero-card tm-hero-card--mint lg:col-span-4" contentClassName="!p-5">
            <ITFlex align="center" gap={2}>
              <ITText className="font-bold">Agregar tipo</ITText>
              <HelpTip text="La clave es interna y no se debe repetir; el nombre es el que ve el personal al solicitar." />
            </ITFlex>
            <div className="mt-3 flex flex-col gap-3">
              <ITInput name="leaveTypeKey" label="Clave" placeholder="EJ. PERMISO_ESPECIAL" value={key} onChange={(event) => setKey(event.target.value)} />
              <ITInput name="leaveTypeName" label="Nombre" placeholder="Permiso especial" value={name} onChange={(event) => setName(event.target.value)} />
              <ITSearchSelect
                name="leaveTypePaid"
                label="Goce de sueldo"
                value={paid}
                onChange={(value) => setPaid(String(value))}
                options={[{ value: "false", label: "Sin goce" }, { value: "true", label: "Con goce" }]}
              />
              <ITButton variant="filled" color="primary" className="tm-save-button w-full" onClick={() => void createType()} disabled={saving}>
                <LuPlus size={13} className="mr-1" />
                {saving ? "Agregando…" : "Agregar tipo"}
              </ITButton>
            </div>
          </ITCard>
        </div>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Más catálogos</ITText>
          <ITText muted className="mt-1 block !text-[12px]">Los tipos de documento del expediente y los puestos de nómina se administran en sus módulos; aquí se concentrarán los catálogos compartidos.</ITText>
        </ITCard>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
