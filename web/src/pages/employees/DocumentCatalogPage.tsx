import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITDataTable,
  ITFlex,
  ITGrid,
  ITInput,
  ITPage,
  ITText,
} from "@axzydev/axzy_ui_system";
import { FaFileAlt, FaPlus } from "react-icons/fa";
import { LuCircleAlert, LuCircleCheck, LuCirclePause, LuFileText, LuPencil, LuPower, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { personalApi, type DocumentType } from "@entities/hr";
import { useGoBack } from "@shared/lib/useGoBack";
import { useCan } from "@entities/user";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { PanelCard } from "@shared/ui/panel-card";
import { RowAction } from "@shared/ui/row-action";
import { TicState } from "@shared/ui/tic";

export default function DocumentCatalogPage() {
  const { t: tt } = useTranslation(["employees", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  // Catalogs are platform-managed (L-07): without `catalogs.manage` the page is read-only.
  const canManage = useCan("catalogs.manage");
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DocumentType | null>(null);
  const [types, setTypes] = useState<DocumentType[] | null>(null);

  useEffect(() => {
    let alive = true;
    personalApi
      .documentTypes(true)
      .then((rows) => alive && setTypes(rows))
      .catch(() => alive && setTypes([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const fetchData = useMemo(
    () => makeClientTableFetch<DocumentType>(() => personalApi.documentTypes(true), {
        active: { match: "equals" },
        required: { match: "equals" },
      }),
    // El cambio de `reloadKey` es la señal para volver a pedir el catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey]
  );

  const openNew = () => {
    setEditing(null);
    setName("");
    setShowForm((v) => !v);
  };

  const openEdit = (type: DocumentType) => {
    setEditing(type);
    setName(type.name);
    setShowForm(true);
  };

  const close = () => {
    setShowForm(false);
    setEditing(null);
  };

  const save = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      if (editing) {
        await personalApi.updateDocumentType(editing.id, { name: name.trim() });
      } else {
        await personalApi.createDocumentType(name.trim());
      }
      close();
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message ?? tt("catalog.saveError"));
    }
  };

  const toggleRequired = async (type: DocumentType) => {
    setError(null);
    try {
      await personalApi.updateDocumentType(type.id, { required: !type.required });
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message ?? tt("catalog.saveError"));
    }
  };

  const toggleActive = async (type: DocumentType) => {
    setError(null);
    try {
      await personalApi.updateDocumentType(type.id, { active: !type.active });
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message ?? tt("catalog.saveError"));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setError(null);
    try {
      await personalApi.removeDocumentType(toDelete.id);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message ?? tt("catalog.deleteError"));
    } finally {
      setToDelete(null);
    }
  };

  const columns: any[] = [
    {
      type: "string",
      key: "name",
      label: tt("catalog.name"),
      width: 300,
      filter: true,
      sortable: false,
      render: (type: DocumentType) => <ITText className="text-[11px] font-bold text-slate-800">{type.name}</ITText>,
    },
    {
      type: "catalog",
      key: "active",
      label: tt("catalog.status"),
      width: 140,
      filter: "catalog",
      catalogOptions: {
        data: [
          { id: "true", name: tt("catalog.active") },
          { id: "false", name: tt("catalog.inactive") },
        ],
      },
      sortable: false,
      render: (type: DocumentType) =>
        type.active ? (
          <ITBadget color="success" size="lg">{tt("catalog.active")}</ITBadget>
        ) : (
          <ITBadget color="danger" size="lg">{tt("catalog.inactive")}</ITBadget>
        ),
    },
    {
      type: "catalog",
      key: "required",
      label: tt("catalog.required"),
      width: 170,
      filter: "catalog",
      sortable: false,
      catalogOptions: {
        data: [
          { id: "true", name: tt("catalog.requiredYes") },
          { id: "false", name: tt("catalog.requiredNo") },
        ],
      },
      render: (type: DocumentType) =>
        canManage ? (
          <ITButton
            variant="text"
            size="lg"
            color={type.required ? "danger" : "gray"}
            onClick={() => toggleRequired(type)}
            title={type.required ? tt("catalog.markOptional") : tt("catalog.markRequired")}
          >
            <ITBadget color={type.required ? "danger" : "gray"} size="lg">
              {type.required ? tt("catalog.requiredYes") : tt("catalog.requiredNo")}
            </ITBadget>
          </ITButton>
        ) : (
          <ITBadget color={type.required ? "danger" : "gray"} size="lg">
            {type.required ? tt("catalog.requiredYes") : tt("catalog.requiredNo")}
          </ITBadget>
        ),
    },
    {
      type: "string",
      key: "action",
      label: "",
      width: 140,
      render: (type: DocumentType) =>
        canManage ? (
        <ITFlex align="center" gap={1}>
          <RowAction icon={<LuPencil size={12} />} label={tt("catalog.edit")} tone="primary" onClick={() => openEdit(type)} />
          <RowAction
            icon={<LuPower size={12} />}
            label={type.active ? tt("catalog.deactivate") : tt("catalog.activate")}
            tone={type.active ? "secondary" : "success"}
            onClick={() => toggleActive(type)}
          />
          {!type.active && (
            <RowAction icon={<LuTrash2 size={12} />} label={tt("catalog.deleteForever")} tone="error" onClick={() => setToDelete(type)} />
          )}
        </ITFlex>
        ) : null,
    },
  ];

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("catalog.title")}
      description={tt("catalog.description")}
      icon={<FaFileAlt size={20} />}
      backAction={() => goBack("/employees")}
      breadcrumbs={[
        { label: tt("common:nav.home"), onClick: () => navigate("/") },
        { label: tt("breadcrumb"), onClick: () => navigate("/employees") },
        { label: tt("catalog.title") },
      ]}
      actions={
        canManage ? (
          <ITButton variant="filled" color="primary" onClick={openNew}>
            <ITFlex align="center" gap={1}>
              <FaPlus size={12} />
              <ITText className="font-bold text-[11px]">{tt("catalog.new")}</ITText>
            </ITFlex>
          </ITButton>
        ) : undefined
      }
    >
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {types && types.length > 0 && (
        <BentoKpiGrid
          items={[
            { id: "all", label: tt("catalog.title"), value: types.length, icon: <LuFileText size={14} /> },
            {
              id: "active",
              label: tt("catalog.active"),
              value: types.filter((type) => type.active).length,
              tone: "success",
              icon: <LuCircleCheck size={14} />,
            },
            {
              id: "inactive",
              label: tt("catalog.inactive"),
              value: types.filter((type) => !type.active).length,
              tone: "warning",
              icon: <LuCirclePause size={14} />,
            },
            {
              id: "required",
              label: tt("catalog.required"),
              value: types.filter((type) => type.required).length,
              tone: "info",
              icon: <LuCircleAlert size={14} />,
            },
          ]}
        />
      )}

      {canManage && showForm && (
        <ITCard contentClassName="flex flex-col gap-3 mb-4">
          <ITText className="text-sm font-bold text-slate-800">
            {editing ? tt("catalog.edit") : tt("catalog.new")}
          </ITText>
          <ITGrid container columns={12} spacing={4}>
            <ITGrid item xs={12} md={6}>
              <ITInput
                name="name"
                label={tt("catalog.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                autoFocus
              />
            </ITGrid>
            <ITGrid item xs={12} md={6}>
              <ITFlex align="end" gap={2} className="h-full">
                <ITButton variant="outlined" color="secondary" onClick={close} className="mt-1">
                  <ITText className="font-bold text-[11px]">{tt("common:actions.cancel")}</ITText>
                </ITButton>
                <ITButton variant="filled" color="primary" onClick={save} disabled={!name.trim()} className="mt-1">
                  <ITText className="font-bold text-[11px]">{tt("common:actions.save")}</ITText>
                </ITButton>
              </ITFlex>
            </ITGrid>
          </ITGrid>
        </ITCard>
      )}

      {types !== null && types.length === 0 ? (
        <PanelCard title={tt("catalog.title")} icon={<LuFileText size={15} />} actions={<HelpTip text="Los tipos de documento definen qué se le pide al personal (INE, contrato, comprobante). Marca como obligatorios los indispensables: el tablero de Expedientes avisa a quien no los tenga." />}>
          <TicState
            kind="empty"
            title={tt("catalog.title")}
            description={tt("catalog.description")}
            action={
              canManage ? (
                <ITButton variant="filled" color="primary" onClick={openNew}>
                  <ITFlex align="center" gap={1}>
                    <FaPlus size={12} />
                    <ITText className="font-bold text-[11px]">{tt("catalog.new")}</ITText>
                  </ITFlex>
                </ITButton>
              ) : undefined
            }
          />
        </PanelCard>
      ) : (
        <PanelCard title={tt("catalog.title")} icon={<LuFileText size={15} />} actions={<HelpTip text="Los tipos de documento definen qué se le pide al personal (INE, contrato, comprobante). Marca como obligatorios los indispensables: el tablero de Expedientes avisa a quien no los tenga." />}>
          <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
            columns={columns as any}
            fetchData={fetchData as any}
            reloadTrigger={reloadKey}
            size="lg"
            onRowClick={(row) => openEdit(row as unknown as DocumentType)}
          />
        </PanelCard>
      )}

      <TicConfirm
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={tt("catalog.deleteForever")}
        message={tt("catalog.deleteForeverConfirm", { name: toDelete?.name })}
        confirmLabel={tt("catalog.deleteForever")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />
    </ITPage>
  );
}
