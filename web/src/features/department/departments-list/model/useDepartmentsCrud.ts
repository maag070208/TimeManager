import { useCallback, useEffect, useState } from "react";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { departmentsApi, type Department } from "@entities/department";

export const useDepartmentsCrud = () => {
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deptToEdit, setDeptToEdit] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");

  const reload = () => setReloadKey((k) => k + 1);

  const handleCreateDept = async () => {
    if (!newDept.trim()) return;
    try {
      await departmentsApi.create({ name: newDept });
      setNewDept("");
      setCreateOpen(false);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openEditDept = (d: Department) => {
    setDeptToEdit(d);
    setEditName(d.name);
  };

  const handleUpdateDept = async () => {
    if (!deptToEdit || !editName.trim()) return;
    try {
      await departmentsApi.update(deptToEdit.id, { name: editName.trim() });
      setDeptToEdit(null);
      setEditName("");
      reload();
    } catch (e: any) {
      setError(e.message);
      setDeptToEdit(null);
    }
  };

  const confirmDeleteDept = async () => {
    if (!deptToDelete) return;
    try {
      await departmentsApi.remove(deptToDelete.id);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
    setDeptToDelete(null);
  };

  const fetchTableData = useCallback(
    async (params: ITDataTableFetchParams) => {
      const res = await departmentsApi.table({
        page: params.page,
        limit: params.limit,
        filters: params.filters,
        sort: params.sort,
      });
      return {
        data: res.data as unknown as Record<string, unknown>[],
        total: res.total,
      };
    },
    []
  );

  return {
    newDept,
    setNewDept,
    error,
    setError,
    createOpen,
    setCreateOpen,
    reloadKey,
    reload,
    deptToDelete,
    setDeptToDelete,
    deptToEdit,
    setDeptToEdit,
    editName,
    setEditName,
    handleCreateDept,
    openEditDept,
    handleUpdateDept,
    confirmDeleteDept,
    fetchTableData,
  };
};

/**
 * Catálogo completo de departamentos (activos e inactivos) para la rejilla de
 * tarjetas: una sola petición, sin paginación de servidor. Se recarga cuando
 * cambia `reloadKey` (altas, ediciones y bajas de `useDepartmentsCrud`).
 */
export const useDepartmentsList = (reloadKey: number) => {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    departmentsApi
      .list(true)
      .then((list) => {
        if (active) setDepartments(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { departments, failed };
};