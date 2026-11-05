import { useCallback, useEffect, useState } from "react";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { departmentsApi, type Department } from "@entities/department";
import { subareaApi, type Subarea } from "@entities/subarea";

export const useSubareasCrud = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  // Filtro de la tabla: incluye departamentos inactivos, que también tienen subáreas.
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");

  const [subareaToEdit, setSubareaToEdit] = useState<Subarea | null>(null);
  const [editName, setEditName] = useState("");

  const [subareaToDelete, setSubareaToDelete] = useState<Subarea | null>(null);

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
    departmentsApi.list(true).then(setAllDepartments).catch(() => setAllDepartments([]));
  }, []);

  const reload = () => setReloadKey((k) => k + 1);

  const handleCreate = async () => {
    if (!newName.trim() || !newDepartmentId) return;
    try {
      await subareaApi.create({ departmentId: newDepartmentId, name: newName.trim() });
      setNewName("");
      setNewDepartmentId("");
      setCreateOpen(false);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openEdit = (s: Subarea) => {
    setSubareaToEdit(s);
    setEditName(s.name);
  };

  const handleUpdate = async () => {
    if (!subareaToEdit || !editName.trim()) return;
    try {
      await subareaApi.update(subareaToEdit.id, { name: editName.trim() });
      setSubareaToEdit(null);
      setEditName("");
      reload();
    } catch (e: any) {
      setError(e.message);
      setSubareaToEdit(null);
    }
  };

  const handleReactivate = async (s: Subarea) => {
    try {
      await subareaApi.update(s.id, { active: true });
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmDelete = async () => {
    if (!subareaToDelete) return;
    try {
      await subareaApi.remove(subareaToDelete.id);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
    setSubareaToDelete(null);
  };

  const fetchTableData = useCallback(async (params: ITDataTableFetchParams) => {
    const res = await subareaApi.table({
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      sort: params.sort,
    });
    return {
      data: res.data as unknown as Record<string, unknown>[],
      total: res.total,
    };
  }, []);

  return {
    departments,
    allDepartments,
    error,
    setError,
    reloadKey,
    createOpen,
    setCreateOpen,
    newName,
    setNewName,
    newDepartmentId,
    setNewDepartmentId,
    subareaToEdit,
    setSubareaToEdit,
    editName,
    setEditName,
    subareaToDelete,
    setSubareaToDelete,
    handleCreate,
    openEdit,
    handleUpdate,
    handleReactivate,
    confirmDelete,
    fetchTableData,
  };
};
