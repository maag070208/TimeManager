import {
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITGrid,
  ITInput,
  ITText,
} from "@axzydev/axzy_ui_system";
import { FaEdit, FaPlus, FaTimes, FaTrashRestore, FaUsers } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { Department, Subarea } from "@entities/department";

interface Props {
  dept: Department;
  canManage: boolean;
  newSubarea: string;
  onNewSubarea: (value: string) => void;
  onAddSubarea: () => void;
  onEditSubarea: (s: Subarea) => void;
  onReactivateSubarea: (s: Subarea) => void;
  onRemoveSubarea: (s: Subarea) => void;
}

export default function DepartmentInfoCard({
  dept,
  canManage,
  newSubarea,
  onNewSubarea,
  onAddSubarea,
  onEditSubarea,
  onReactivateSubarea,
  onRemoveSubarea,
}: Props) {
  const { t: tt } = useTranslation(["departments"]);
  return (
    <ITCard className="p-6">
      <ITGrid container columns={12} spacing={4}>
        <ITGrid item xs={12} md={5}>
          <ITFlex direction="column" gap={1}>
            <ITText className="text-[12px] font-semibold text-slate-500">
              {tt("detail.department")}
            </ITText>
            <ITText className="font-bold text-slate-800">
              {dept.name}
            </ITText>
          </ITFlex>
        </ITGrid>

        <ITGrid item xs={12} md={3}>
          <ITFlex direction="column" gap={1}>
            <ITText className="text-[12px] font-semibold text-slate-500">
              {tt("detail.status")}
            </ITText>
            <ITFlex align="center" gap={2}>
              <ITBadget color={dept.active ? "success" : "danger"} size="lg">
                {dept.active ? tt("detail.active") : tt("detail.inactive")}
              </ITBadget>
            </ITFlex>
          </ITFlex>
        </ITGrid>

        <ITGrid item xs={12} md={4}>
          <ITFlex direction="column" gap={1}>
            <ITText className="text-[12px] font-semibold text-slate-500">
              {tt("detail.users")}
            </ITText>
            <ITFlex align="center" gap={2} className="text-slate-600">
              <FaUsers size={14} />
              <ITText className="font-bold">{tt("detail.userCount", { count: dept._count?.users ?? 0 })}</ITText>
            </ITFlex>
          </ITFlex>
        </ITGrid>

        <ITGrid item xs={12}>
          <ITFlex direction="column" gap={2}>
            <ITText className="text-[12px] font-semibold text-slate-500">
              {tt("detail.areas")}
            </ITText>
            {dept.subareas.length === 0 ? (
              <ITText className="text-[12px] font-bold text-slate-400">
                {tt("detail.noSubareas")}
              </ITText>
            ) : (
              <ITFlex wrap="wrap" gap={2}>
                {dept.subareas.map((s) => (
                  <ITFlex
                    key={s.id}
                    align="center"
                    gap={2}
                    className={
                      s.active
                        ? "bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200"
                        : "bg-rose-50 text-rose-400 px-3 py-1.5 rounded-full border border-rose-200"
                    }
                  >
                    <ITText className="text-[12px] font-semibold">
                      {s.name}
                    </ITText>
                    {!s.active && (
                      <ITText className="text-[10px] font-semibold">
                        {tt("detail.subareaInactive")}
                      </ITText>
                    )}
                    {canManage && s.active && (
                      <FaEdit
                        size={10}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                        onClick={() => onEditSubarea(s)}
                        title={tt("detail.editSubarea")}
                      />
                    )}
                    {canManage && !s.active && (
                      <FaTrashRestore
                        size={10}
                        className="text-rose-400 hover:text-emerald-600 cursor-pointer"
                        onClick={() => onReactivateSubarea(s)}
                        title={tt("detail.reactivateSubarea")}
                      />
                    )}
                    {canManage && (
                      <FaTimes
                        size={10}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        onClick={() => onRemoveSubarea(s)}
                        title={tt("detail.removeSubarea")}
                      />
                    )}
                  </ITFlex>
                ))}
              </ITFlex>
            )}
          </ITFlex>
        </ITGrid>

        {canManage && (
          <ITGrid item xs={12}>
            <ITFlex gap={2}>
              <ITInput
                name="newSubarea"
                value={newSubarea}
                onChange={(e) => onNewSubarea(e.target.value)}
                placeholder={tt("detail.newSubareaPlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && onAddSubarea()}
                className="flex-1"
              />
              <ITButton
                variant="filled"
                color="primary"
                onClick={onAddSubarea}
                disabled={!newSubarea.trim()}
                title={tt("detail.addSubarea")}
              >
                <ITFlex align="center" gap={1}>
                  <FaPlus size={12} />
                  <ITText className="font-bold text-[11px]">{tt("detail.add")}</ITText>
                </ITFlex>
              </ITButton>
            </ITFlex>
          </ITGrid>
        )}
      </ITGrid>
    </ITCard>
  );
}