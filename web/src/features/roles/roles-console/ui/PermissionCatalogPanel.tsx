import { useMemo, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITDataTable, ITFlex, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { FaEdit, FaPlus, FaPowerOff, FaTrashRestore } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import type { PermissionScope } from "@entities/user";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { usePermissionCatalog } from "../model/useRolesAdmin";
import PermissionFormDialog, { type PermissionSubmit } from "./PermissionFormDialog";

const SCOPE_ORDER: PermissionScope[] = ["NONE", "OWN", "AREA", "ALL"];

interface ToastState {
  message: string;
  type: "success" | "error";
}

interface Props {
  /** Módulos existentes (para sugerirlos al crear un permiso). */
  modules: readonly string[];
  /** Tras crear, editar o (des)activar: la consola recarga la matriz sin perder el borrador. */
  onChanged: () => void;
}

export default function PermissionCatalogPanel({ modules, onChanged }: Props) {
  const { t } = useTranslation(["roles", "common"]);
  const { list, reloadKey, create, update, toggleActive, saving, error, setError } =
    usePermissionCatalog();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PermissionCatalog | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const fetchData = useMemo(
    () => makeClientTableFetch<PermissionCatalog>(list, {
        scopes: { match: "equals", sortValue: (p) => p.scopes.length },
        sensitive: { match: "equals" },
        active: { match: "equals" },
      }),
    [list]
  );

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (permission: PermissionCatalog) => {
    setEditing(permission);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (submit: PermissionSubmit): Promise<boolean> => {
    try {
      if (submit.mode === "update") await update(submit.key, submit.dto);
      else await create(submit.dto);
      setToast({ message: submit.mode === "update" ? t("catalog.updated") : t("catalog.created"), type: "success" });
      onChanged();
      return true;
    } catch {
      // El hook deja el mensaje del API en `error`; el diálogo lo muestra.
      return false;
    }
  };

  const handleToggle = async (permission: PermissionCatalog) => {
    try {
      await toggleActive(permission);
      onChanged();
      setToast({
        message: permission.active
          ? t("catalog.deactivated")
          : t("catalog.activated"),
        type: "success",
      });
    } catch {
      setToast({ message: t("catalog.saveError"), type: "error" });
    }
  };

  const columns: any[] = [
    {
      type: "string",
      key: "key",
      label: t("catalog.columns.key"),
      sortable: false,
      width: 260,
      filter: true,
      render: (permission: PermissionCatalog) => (
        <ITText className="font-mono text-[11px] text-slate-700">
          {permission.key}
        </ITText>
      ),
    },
    {
      type: "string",
      key: "module",
      label: t("catalog.columns.module"),
      sortable: false,
      width: 200,
      filter: true,
      render: (permission: PermissionCatalog) => (
        <ITText className="text-[11px] text-slate-600">{permission.module}</ITText>
      ),
    },
    {
      type: "string",
      key: "name",
      label: t("catalog.columns.name"),
      sortable: false,
      width: 240,
      filter: true,
      render: (permission: PermissionCatalog) => (
        <ITText className="text-[11px] font-bold text-slate-800">
          {permission.name}
        </ITText>
      ),
    },
    {
      type: "string",
      key: "scopes",
      label: t("catalog.columns.scopes"),
      width: 260,
      filter: "catalog",
      catalogOptions: { data: SCOPE_ORDER.map((id) => ({ id, name: t(`scope.${id}`) })) },
      render: (permission: PermissionCatalog) => (
        <ITFlex align="center" gap={1} wrap="wrap">
          {permission.scopes.map((scope) => (
            <ITBadget key={scope} color="primary" variant="outlined" size="sm">
              {t(`scope.${scope}`)}
            </ITBadget>
          ))}
        </ITFlex>
      ),
    },
    {
      type: "catalog",
      key: "sensitive",
      label: t("catalog.columns.sensitive"),
      width: 130,
      sortable: false,
      filter: "catalog",
      catalogOptions: {
        data: [
          { id: "true", name: t("catalog.sensitive") },
          { id: "false", name: t("catalog.notSensitive") },
        ],
      },
      render: (permission: PermissionCatalog) =>
        permission.sensitive ? (
          <ITBadget color="warning" size="sm">
            {t("catalog.sensitive")}
          </ITBadget>
        ) : (
          <ITText className="text-[11px] text-slate-300">—</ITText>
        ),
    },
    {
      type: "number",
      key: "sortOrder",
      label: t("catalog.columns.sortOrder"),
      width: 110,
      sortable: false,
      render: (permission: PermissionCatalog) => (
        <ITText className="text-[11px] text-slate-500">{permission.sortOrder}</ITText>
      ),
    },
    {
      type: "catalog",
      key: "active",
      label: t("catalog.columns.active"),
      width: 130,
      filter: "catalog",
      catalogOptions: {
        data: [
          { id: "true", name: t("catalog.active") },
          { id: "false", name: t("catalog.inactive") },
        ],
      },
      sortable: false,
      render: (permission: PermissionCatalog) =>
        permission.active ? (
          <ITBadget color="success" size="sm">
            {t("catalog.active")}
          </ITBadget>
        ) : (
          <ITBadget color="danger" size="sm">
            {t("catalog.inactive")}
          </ITBadget>
        ),
    },
    {
      type: "string",
      key: "actions",
      label: "",
      width: 110,
      render: (permission: PermissionCatalog) => (
        <ITFlex align="center" gap={2}>
          <ITButton
            variant="outlined"
            color="primary"
            size="sm"
            onClick={() => openEdit(permission)}
            title={t("common:actions.edit")}
          >
            <FaEdit size={12} />
          </ITButton>
          <ITButton
            variant="outlined"
            color={permission.active ? "secondary" : "success"}
            size="sm"
            onClick={() => handleToggle(permission)}
            disabled={saving}
            title={permission.active ? t("catalog.deactivate") : t("catalog.activate")}
          >
            {permission.active ? <FaPowerOff size={12} /> : <FaTrashRestore size={12} />}
          </ITButton>
        </ITFlex>
      ),
    },
  ];

  return (
    <ITFlex direction="column" gap={3}>
      <ITFlex align="center" justify="between" wrap="wrap" gap={3}>
        <ITText className="text-[11px] text-slate-500">{t("catalog.subtitle")}</ITText>
        <ITButton variant="filled" color="primary" size="sm" onClick={openCreate}>
          <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
            <FaPlus size={10} /> {t("catalog.new")}
          </ITText>
        </ITButton>
      </ITFlex>

      {error && !showForm && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      <ITDataTable showViewToggle={false}
        columns={columns as any}
        fetchData={fetchData as any}
        reloadTrigger={reloadKey}
        size="sm"
        defaultItemsPerPage={25}
        itemsPerPageOptions={[25, 50, 100]}
        layout="fixed"
        density="compact"
        rowHeight={50}
        virtualized
        virtualizedMaxHeight={460}
      />

      <PermissionFormDialog
        isOpen={showForm}
        permission={editing}
        modules={modules}
        saving={saving}
        error={showForm ? error : null}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
      />

      {toast && (
        <ITToast
          message={toast.message}
          type={toast.type}
          position="bottom-center"
          duration={2500}
          onClose={() => setToast(null)}
        />
      )}
    </ITFlex>
  );
}
