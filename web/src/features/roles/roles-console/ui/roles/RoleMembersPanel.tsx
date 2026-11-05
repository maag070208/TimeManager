import { useMemo, useState } from "react";
import { ITButton, ITConfirmDialog, ITInput, ITSearchSelect, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { FaSearch, FaShieldAlt, FaUserMinus, FaUserPlus } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { AccessMember } from "@entities/permission";
import { roleLabel } from "@entities/user";
import { initialsOfName, matchesMember, type AccessMembersState } from "../../model/useAccessMembers";
import { RoleChip } from "../shared/RoleAvatar";

interface Props {
  role: string;
  roleActive: boolean;
  members: AccessMembersState;
  onViewAccess: (userId: string) => void;
  notify: (message: string, type: "success" | "error") => void;
}

/**
 * Personas con el rol (principal o adicional). Desde aquí se agrega el rol a
 * alguien como **adicional** y se quita un adicional; el principal se cambia
 * en la ficha del usuario.
 */
export default function RoleMembersPanel({ role, roleActive, members, onViewAccess, notify }: Props) {
  const { t } = useTranslation("roles");
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<string>("");
  const [removing, setRemoving] = useState<AccessMember | null>(null);

  const withRole = members.membersOf(role);
  const rows = withRole.filter((member) => matchesMember(member, query));

  const candidates = useMemo(
    () =>
      members.members
        .filter((member) => member.active && member.role !== role && !member.extraRoles.includes(role))
        .map((member) => ({
          value: member.id,
          label: `${member.name} · @${member.username}${member.department ? ` · ${member.department}` : ""}`,
        })),
    [members.members, role]
  );

  const add = async () => {
    if (!candidate) return;
    const result = await members.addToRole(role, candidate);
    if (result.ok) {
      setCandidate("");
      notify(t("members.added", { role: roleLabel(role) }), "success");
    } else {
      notify(result.error ?? t("errors.addMember"), "error");
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const result = await members.removeFromRole(role, removing.id);
    notify(
      result.ok ? t("members.removed", { name: removing.name }) : result.error ?? t("errors.removeMember"),
      result.ok ? "success" : "error"
    );
    setRemoving(null);
  };

  return (
    <ITStack spacing={2}>
      <ITFlex align="end" wrap="wrap" gap={2}>
        <div className="min-w-[240px] max-w-md flex-1">
          <ITSearchSelect
            name="role_member_candidate"
            size="sm"
            label={t("members.addLabel")}
            placeholder={roleActive ? t("members.addPlaceholder") : t("members.roleInactive")}
            options={candidates}
            value={candidate}
            disabled={!roleActive || members.busy}
            onChange={(value) => setCandidate(String(value ?? ""))}
            onClear={() => setCandidate("")}
          />
        </div>
        <ITButton variant="filled" color="primary" size="sm" disabled={!candidate || members.busy} onClick={add}>
          <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
            <FaUserPlus size={11} /> {t("members.add")}
          </ITText>
        </ITButton>
        <div className="ml-auto w-full max-w-[220px]">
          <ITInput
            name="role_member_search"
            size="sm"
            placeholder={t("members.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            iconLeft={<FaSearch size={11} />}
          />
        </div>
        <ITText className="w-full text-[10px] text-slate-400">{t("members.addHint")}</ITText>
      </ITFlex>

      {rows.length === 0 ? (
        <ITText className="py-8 text-center text-[12px] italic text-slate-400">
          {withRole.length === 0 ? t("members.empty") : t("matrix.noResults")}
        </ITText>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-[var(--it-card-bg)]">
          {rows.map((member, index) => {
            const primary = member.role === role;
            const otherRoles = [member.role, ...member.extraRoles].filter((key) => key !== role);
            return (
              <div
                key={member.id}
                className={`flex flex-wrap items-center gap-2 px-3 py-1.5 ${index > 0 ? "border-t border-slate-100" : ""} ${
                  member.active ? "" : "opacity-60"
                }`}
              >
                <ITText as="span" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-[10px] font-black text-primary-500">
                  {initialsOfName(member.name)}
                </ITText>
                <div className="min-w-[180px] flex-1">
                  <ITFlex align="center" wrap="wrap" gap={1.5}>
                    <ITText as="span" className="text-[12px] font-bold text-slate-800">{member.name}</ITText>
                    <ITText as="span"
                      className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                        primary ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {primary ? t("members.primary") : t("members.extra")}
                    </ITText>
                    {!member.active && (
                      <ITText as="span" className="rounded-full bg-rose-50 px-2 py-0.5 text-[12px] font-semibold text-rose-600">
                        {t("members.inactive")}
                      </ITText>
                    )}
                    {member.exceptions > 0 && (
                      <ITText as="span" className="rounded-full bg-violet-50 px-2 py-0.5 text-[12px] font-semibold text-violet-600">
                        {t("members.exceptions", { count: member.exceptions })}
                      </ITText>
                    )}
                  </ITFlex>
                  <ITText className="text-[11px] text-slate-400">
                    @{member.username}
                    {member.employeeNumber && <> · #{member.employeeNumber}</>}
                    {member.department && <> · {member.department}</>}
                  </ITText>
                </div>
                {otherRoles.length > 0 && (
                  <ITFlex wrap="wrap" gap={1}>
                    {otherRoles.map((key) => (
                      <RoleChip key={key} role={key} />
                    ))}
                  </ITFlex>
                )}
                <ITFlex align="center" gap={1.5}>
                  <ITButton variant="outlined" color="primary" size="sm" onClick={() => onViewAccess(member.id)}>
                    <ITText as="span" className="flex items-center gap-1 text-[11px] font-bold">
                      <FaShieldAlt size={10} /> {t("members.viewAccess")}
                    </ITText>
                  </ITButton>
                  {!primary && (
                    <ITButton
                      variant="outlined"
                      color="danger"
                      size="sm"
                      disabled={members.busy}
                      onClick={() => setRemoving(member)}
                    >
                      <ITText as="span" className="flex items-center gap-1 text-[11px] font-bold">
                        <FaUserMinus size={10} /> {t("members.remove")}
                      </ITText>
                    </ITButton>
                  )}
                </ITFlex>
              </div>
            );
          })}
        </div>
      )}

      <ITConfirmDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        loading={members.busy}
        variant="danger"
        title={t("members.removeTitle")}
        message={t("members.removeConfirm", { name: removing?.name ?? "", role: roleLabel(role) })}
        confirmLabel={t("members.remove")}
      />
    </ITStack>
  );
}
