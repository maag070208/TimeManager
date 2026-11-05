import { useCallback, useEffect, useState } from "react";
import { departmentsApi, type Department, type Subarea } from "@entities/department";
import { subareaApi } from "@entities/subarea";

export const useDepartmentDetail = (id?: string, onDeleted?: () => void) => {
  const [dept, setDept] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSubarea, setNewSubarea] = useState("");
  const [subareaToDelete, setSubareaToDelete] = useState<Subarea | null>(null);
  const [subareaToEdit, setSubareaToEdit] = useState<Subarea | null>(null);
  const [editSubareaName, setEditSubareaName] = useState("");
  const [deptToDelete, setDeptToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDept(await departmentsApi.get(id));
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddSubarea = async () => {
    if (!id || !newSubarea.trim()) return;
    try {
      await subareaApi.create({ departmentId: id, name: newSubarea.trim() });
      setNewSubarea("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openEditSubarea = (s: Subarea) => {
    setSubareaToEdit(s);
    setEditSubareaName(s.name);
  };

  const handleUpdateSubarea = async () => {
    if (!subareaToEdit || !editSubareaName.trim()) return;
    try {
      await subareaApi.update(subareaToEdit.id, { name: editSubareaName.trim() });
      setSubareaToEdit(null);
      setEditSubareaName("");
      await load();
    } catch (e: any) {
      setError(e.message);
      setSubareaToEdit(null);
    }
  };

  const handleReactivateSubarea = async (s: Subarea) => {
    try {
      await subareaApi.update(s.id, { active: true });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmRemoveSubarea = async () => {
    if (!subareaToDelete) return;
    try {
      await subareaApi.remove(subareaToDelete.id);
      setSubareaToDelete(null);
      await load();
    } catch (e: any) {
      setError(e.message);
      setSubareaToDelete(null);
    }
  };

  const confirmDeleteDept = async () => {
    if (!dept) return;
    setDeleting(true);
    try {
      await departmentsApi.remove(dept.id);
      onDeleted?.();
    } catch (e: any) {
      setError(e.message);
      setDeptToDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return {
    dept,
    error,
    setError,
    deleting,
    newSubarea,
    setNewSubarea,
    subareaToDelete,
    setSubareaToDelete,
    subareaToEdit,
    setSubareaToEdit,
    editSubareaName,
    setEditSubareaName,
    deptToDelete,
    setDeptToDelete,
    handleAddSubarea,
    openEditSubarea,
    handleUpdateSubarea,
    handleReactivateSubarea,
    confirmRemoveSubarea,
    confirmDeleteDept,
  };
};