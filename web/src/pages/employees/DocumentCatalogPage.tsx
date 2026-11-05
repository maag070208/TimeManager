import { useMemo, useState } from "react";
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
import { FaEdit, FaFileAlt, FaPlus, FaTrash, FaTrashRestore } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { LangostinConfirm } from "@shared/ui/langostin-confirm";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { personalApi, type DocumentType } from "@entities/hr";
import { useGoBack } from "@shared/lib/useGoBack";

export default function DocumentCatalogPage() {
  const { t: tt } = useTranslation(["employees", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DocumentType | null>(null);

  const fetchData = useMemo(
    () => makeClientTableFetch<DocumentType>(() => personalApi.documentTypes(true), {
        active: { match: "equals" },
        required: { match: "equals" },
      }),
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
      render: (type: DocumentType) => (
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
      ),
    },
    {
      type: "string",
      key: "action",
      label: "",
      width: 140,
      render: (type: DocumentType) => (
        <ITFlex align="center" gap={2}>
          <ITButton variant="outlined" color="primary" size="lg" onClick={() => openEdit(type)}>
            <FaEdit size={12} />
          </ITButton>
          <ITButton
            variant="outlined"
            color={type.active ? "secondary" : "success"}
            size="lg"
            onClick={() => toggleActive(type)}
            title={type.active ? tt("catalog.deactivate") : tt("catalog.activate")}
          >
            {type.active ? <FaTrash size={12} /> : <FaTrashRestore size={12} />}
          </ITButton>
          {!type.active && (
            <ITButton
              variant="outlined"
              color="error"
              size="lg"
              onClick={() => setToDelete(type)}
              title={tt("catalog.deleteForever")}
            >
              <FaTrash size={12} />
            </ITButton>
          )}
        </ITFlex>
      ),
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
        <ITButton variant="filled" color="primary" onClick={openNew}>
          <ITFlex align="center" gap={1}>
            <FaPlus size={12} />
            <ITText className="font-bold text-[11px]">{tt("catalog.new")}</ITText>
          </ITFlex>
        </ITButton>
      }
    >
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {showForm && (
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

      <ITDataTable showViewToggle={false}
        columns={columns as any}
        fetchData={fetchData as any}
        reloadTrigger={reloadKey}
        size="lg"
        defaultItemsPerPage={25}
        itemsPerPageOptions={[25, 50, 100]}
        layout="fixed"
        density="compact"
        rowHeight={50}
        virtualized
        virtualizedMaxHeight={460}
      />

      <LangostinConfirm
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
