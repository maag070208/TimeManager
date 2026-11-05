import { useState } from "react";
import {
  ITAlert,
  ITButton,
  ITDialog,
  ITFlex,
  ITInput,
  ITPage,
  ITText,
} from "@axzydev/axzy_ui_system";
import { FaBuilding, FaPlus } from "react-icons/fa";
import { LuBuilding2, LuPencil } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import {
  DepartmentsCatalog,
  useDepartmentsCrud,
  useDepartmentsList,
} from "@features/department/departments-list";
import { useGoBack } from "@shared/lib/useGoBack";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LangostinConfirm } from "@shared/ui/langostin-confirm";

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["departments", "common"]);
  const canManage = useCan("departments.manage");

  const crud = useDepartmentsCrud();
  const list = useDepartmentsList(crud.reloadKey);
  const [deleting, setDeleting] = useState(false);

  const newButton = (
    <ITButton variant="filled" color="primary" onClick={() => crud.setCreateOpen(true)}>
      <ITFlex align="center" gap={1}>
        <FaPlus size={12} />
        <ITText className="font-bold text-[11px]">{tt("list.new")}</ITText>
      </ITFlex>
    </ITButton>
  );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await crud.confirmDeleteDept();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("list.title")}
      description={tt("list.description")}
      backAction={() => goBack("/")}
      icon={<FaBuilding size={20} />}
      breadcrumbs={[
        { label: tt("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: tt("list.breadcrumb") },
      ]}
      actions={canManage ? newButton : undefined}
    >
      {crud.error && (
        <ITAlert variant="error" dismissible onDismiss={() => crud.setError(null)}>
          {crud.error}
        </ITAlert>
      )}

      <DepartmentsCatalog
        departments={list.departments}
        failed={list.failed}
        canManage={canManage}
        onRetry={crud.reload}
        onCreate={() => crud.setCreateOpen(true)}
        onView={(d) => navigate(`/departments/${d.id}`)}
        onEdit={crud.openEditDept}
        onDelete={crud.setDeptToDelete}
      />

      <ITDialog
        isOpen={crud.createOpen}
        onClose={() => crud.setCreateOpen(false)}
        className="it-dialog-panel"
      >
        <DialogHeader
          icon={<LuBuilding2 size={20} />}
          title={tt("list.new")}
          subtitle={tt("list.createSubtitle")}
        />
        <ITFlex direction="column" gap={4}>
          <ITInput
            name="newDept"
            label={tt("list.nameLabel")}
            value={crud.newDept}
            onChange={(e) => crud.setNewDept(e.target.value)}
            placeholder={tt("list.newPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && crud.handleCreateDept()}
            autoFocus
          />
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => crud.setCreateOpen(false)}>
              {tt("common:actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={crud.handleCreateDept}
              disabled={!crud.newDept.trim()}
            >
              <ITFlex align="center" gap={1}>
                <FaPlus size={12} />
                <ITText className="font-bold text-[11px]">{tt("list.create")}</ITText>
              </ITFlex>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      <ITDialog
        isOpen={!!crud.deptToEdit}
        onClose={() => crud.setDeptToEdit(null)}
        className="it-dialog-panel"
      >
        <DialogHeader
          icon={<LuPencil size={20} />}
          title={tt("list.editTitle")}
          subtitle={tt("list.editSubtitle")}
        />
        <ITFlex direction="column" gap={4}>
          <ITInput
            name="editDept"
            label={tt("list.nameLabel")}
            value={crud.editName}
            onChange={(e) => crud.setEditName(e.target.value)}
            placeholder={tt("list.editPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && crud.handleUpdateDept()}
            autoFocus
          />
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => crud.setDeptToEdit(null)}>
              {tt("common:actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={crud.handleUpdateDept}
              disabled={!crud.editName.trim()}
            >
              <ITText className="font-bold text-[11px]">{tt("common:actions.save")}</ITText>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      <LangostinConfirm
        isOpen={!!crud.deptToDelete}
        onClose={() => crud.setDeptToDelete(null)}
        onConfirm={confirmDelete}
        title={crud.deptToDelete?.active ? tt("list.delete") : tt("list.deleteForever")}
        message={
          crud.deptToDelete?.active
            ? tt("list.deleteActive", { name: crud.deptToDelete?.name })
            : tt("list.deleteForeverMsg", { name: crud.deptToDelete?.name })
        }
        confirmLabel={
          crud.deptToDelete?.active ? tt("common:actions.delete") : tt("list.deleteForever")
        }
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
        loading={deleting}
      />
    </ITPage>
  );
}
