import {
  ITAlert,
  ITButton,
  ITConfirmDialog,
  ITDialog,
  ITFlex,
  ITGrid,
  ITInput,
  ITPage,
  ITText,
} from "@axzydev/axzy_ui_system";
import { FaBuilding, FaTrash, FaTrashRestore } from "react-icons/fa";
import { LuLayers, LuShieldCheck, LuUsers } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import {
  DepartmentInfoCard,
  useDepartmentDetail,
} from "@features/department/department-detail";
import { useGoBack } from "@shared/lib/useGoBack";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { PanelCard } from "@shared/ui/panel-card";
import { HelpTip } from "@shared/ui/help-tip";

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["departments", "common"]);
  const canManage = useCan("departments.manage");

  const detail = useDepartmentDetail(id, () => goBack("/departments"));

  if (!detail.dept) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("detail.loadingTitle")}
        backAction={() => goBack("/departments")}
        icon={<FaBuilding size={20} />}
        breadcrumbs={[
          { label: tt("detail.breadcrumbDepartments"), onClick: () => navigate("/departments") },
          { label: tt("detail.breadcrumbDetail") },
        ]}
        loading={!detail.error}
      >
        {detail.error ? (
          <ITAlert variant="error" dismissible onDismiss={() => detail.setError(null)}>
            {detail.error}
          </ITAlert>
        ) : null}
      </ITPage>
    );
  }

  const dept = detail.dept;

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("detail.title")}
      description={dept.name}
      backAction={() => goBack("/departments")}
      icon={<FaBuilding size={20} />}
      breadcrumbs={[
        { label: tt("detail.breadcrumbDepartments"), onClick: () => navigate("/departments") },
        { label: dept.name },
      ]}
      actions={
        canManage ? (
          <ITButton
            variant="outlined"
            size="lg"
            color="error"
            onClick={() => detail.setDeptToDelete(true)}
            title={dept.active ? tt("detail.deleteDept") : tt("detail.deleteForever")}
          >
            {dept.active ? <FaTrash size={12} /> : <FaTrashRestore size={12} />}
          </ITButton>
        ) : undefined
      }
    >
      {detail.error && (
        <ITAlert variant="error" dismissible onDismiss={() => detail.setError(null)}>
          {detail.error}
        </ITAlert>
      )}

      <BentoKpiGrid
        items={[
          {
            id: "people",
            label: tt("detail.users"),
            value: dept._count?.users ?? 0,
            icon: <LuUsers size={14} />,
            caption: tt("detail.userCount", { count: dept._count?.users ?? 0 }),
          },
          {
            id: "areas",
            label: tt("detail.areas"),
            value: dept.subareas.length,
            icon: <LuLayers size={14} />,
            caption: tt("detail.userCount", { count: dept.subareas.length }),
          },
          {
            id: "status",
            label: tt("detail.status"),
            value: dept.active ? tt("detail.active") : tt("detail.inactive"),
            tone: dept.active ? "success" : "warning",
            icon: <LuShieldCheck size={14} />,
          },
        ]}
      />

      <ITGrid container columns={12} spacing={5} className="items-start">
        <ITGrid item xs={12} md={8} className="flex flex-col gap-5 min-w-0">
          <DepartmentInfoCard
            dept={dept}
            canManage={canManage}
            newSubarea={detail.newSubarea}
            onNewSubarea={detail.setNewSubarea}
            onAddSubarea={detail.handleAddSubarea}
            onEditSubarea={detail.openEditSubarea}
            onReactivateSubarea={detail.handleReactivateSubarea}
            onRemoveSubarea={detail.setSubareaToDelete}
          />
        </ITGrid>

        <ITGrid item xs={12} md={4} className="w-full min-w-0">
          <PanelCard
            title={tt("detail.areas")}
            icon={<LuLayers size={15} />}
            actions={
              <HelpTip text="Las subáreas viven dentro de un departamento y agrupan al personal para horarios, asistencia y pre nómina. Puedes agregarlas, renombrarlas o desactivarlas aquí." />
            }
          >
            <ITFlex direction="column" gap={1}>
              <ITText className="text-[12.5px] text-slate-600">
                {tt("detail.userCount", { count: dept.subareas.length })}
              </ITText>
              <ITText className="text-[12px] text-slate-500">
                {tt("detail.areas")} · {dept.active ? tt("detail.active") : tt("detail.inactive")}
              </ITText>
            </ITFlex>
          </PanelCard>
        </ITGrid>
      </ITGrid>

      <ITDialog
        isOpen={!!detail.subareaToEdit}
        onClose={() => detail.setSubareaToEdit(null)}
        className="it-dialog-panel"
        title={tt("detail.editSubareaTitle")}
      >
        <ITFlex direction="column" gap={3}>
          <ITInput
            name="editSubarea"
            value={detail.editSubareaName}
            onChange={(e) => detail.setEditSubareaName(e.target.value)}
            placeholder={tt("detail.editSubareaPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && detail.handleUpdateSubarea()}
            autoFocus
          />
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" onClick={() => detail.setSubareaToEdit(null)}>
              {tt("common:actions.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={detail.handleUpdateSubarea}
              disabled={!detail.editSubareaName.trim()}
            >
              <ITText className="font-bold text-[11px]">{tt("common:actions.save")}</ITText>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      <ITConfirmDialog
        isOpen={!!detail.subareaToDelete}
        onClose={() => detail.setSubareaToDelete(null)}
        onConfirm={detail.confirmRemoveSubarea}
        title={detail.subareaToDelete?.active ? tt("detail.removeSubarea") : tt("detail.deleteForever")}
        message={
          detail.subareaToDelete?.active
            ? tt("detail.deleteSubareaActive", { name: detail.subareaToDelete?.name })
            : tt("detail.deleteSubareaForever", { name: detail.subareaToDelete?.name })
        }
        confirmLabel={detail.subareaToDelete?.active ? tt("common:actions.delete") : tt("detail.deleteForever")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />

      <ITConfirmDialog
        isOpen={detail.deptToDelete}
        onClose={() => detail.setDeptToDelete(false)}
        onConfirm={detail.confirmDeleteDept}
        title={dept.active ? tt("detail.deleteDept") : tt("detail.deleteForever")}
        message={
          dept.active
            ? tt("detail.deleteActive", { name: dept.name })
            : tt("detail.deleteForeverMsg", { name: dept.name })
        }
        confirmLabel={dept.active ? tt("common:actions.delete") : tt("detail.deleteForever")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />
    </ITPage>
  );
}