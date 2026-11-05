import { useMemo, useState } from "react";
import { ITCard, ITFlex, ITInput, ITStack, ITText } from "@axzydev/axzy_ui_system";
import { FaSearch, FaUsers } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { RoleAdmin } from "@entities/permission";
import { roleLabel } from "@entities/user";
import { normalizeText } from "../../model/access-levels";
import type { RolesAdminState } from "../../model/useRolesAdmin";
import { ROLE_TONES, roleTone } from "../shared/tokens";
import RoleAvatar from "../shared/RoleAvatar";

interface Props {
  admin: RolesAdminState;
  selectedRole: string | null;
  onSelect: (role: string) => void;
}

/** Lista de roles agrupada por módulo, con permisos, personas y cambios sin guardar. */
export default function RoleList({ admin, selectedRole, onSelect }: Props) {
  const { t } = useTranslation("roles");
  const [query, setQuery] = useState("");
  const { data, rolesMeta, permissionsByRole, changeDetails } = admin;
  const catalogTotal = data?.catalog.length ?? 0;

  const metaOf = (key: string): RoleAdmin | undefined => rolesMeta.find((role) => role.key === key);
  const pendingByRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const change of changeDetails) map.set(change.role, (map.get(change.role) ?? 0) + 1);
    return map;
  }, [changeDetails]);

  const groups = useMemo(() => {
    const needle = normalizeText(query.trim());
    const map = new Map<string, string[]>();
    for (const key of data?.roles ?? []) {
      const meta = rolesMeta.find((role) => role.key === key);
      const label = roleLabel(key);
      if (needle && !normalizeText(label).includes(needle) && !key.toLowerCase().includes(needle)) continue;
      const module = meta?.module?.trim() || t("roleList.noModule");
      map.set(module, [...(map.get(module) ?? []), key]);
    }
    return [...map.entries()];
  }, [data, rolesMeta, query, t]);

  return (
    <ITCard contentClassName="!p-2" className="lg:sticky lg:top-4">
      <ITFlex direction="column" gap={2}>
      <ITInput
        name="role_list_search"
        size="sm"
        placeholder={t("roleList.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        iconLeft={<FaSearch size={12} />}
      />
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
        {groups.length === 0 && (
          <ITText className="py-6 text-center text-[11px] italic text-slate-400">{t("matrix.noResults")}</ITText>
        )}
        {groups.map(([module, roles]) => (
          <ITStack key={module} spacing={0.5}>
            <ITText className="px-2 text-[12px] font-semibold text-slate-400">{module}</ITText>
            {roles.map((key) => {
              const meta = metaOf(key);
              const selected = key === selectedRole;
              const pending = pendingByRole.get(key) ?? 0;
              return (
                <ITFlex
                  key={key}
                  as="button"
                  align="center"
                  gap={2}
                  onClick={() => onSelect(key)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
                    selected ? "bg-primary-600/10" : "hover:bg-slate-50"
                  } ${meta && !meta.active ? "opacity-60" : ""}`}
                >
                  <RoleAvatar role={key} size="sm" />
                  <ITText as="span" className="min-w-0 flex-1">
                    <ITText as="span" className="flex items-center gap-1.5">
                      <ITText as="span" className={`truncate text-[12px] font-bold ${selected ? "text-primary-500" : "text-slate-800"}`}>
                        {roleLabel(key)}
                      </ITText>
                      {pending > 0 && (
                        <ITText
                          as="span"
                          aria-label={t("matrix.changeCount", { count: pending })}
                          title={t("matrix.changeCount", { count: pending })}
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </ITText>
                    <ITText as="span" className="flex items-center gap-2 text-[10px] text-slate-400">
                      <ITText as="span">{t("roleList.permissions", { count: Object.keys(permissionsByRole[key] ?? {}).length })}</ITText>
                      <ITText as="span" className="inline-flex items-center gap-1">
                        <FaUsers size={9} /> {meta?.userCount ?? 0}
                      </ITText>
                      {meta && !meta.active && <ITText as="span" className="font-bold text-rose-500">{t("access.inactiveRole")}</ITText>}
                    </ITText>
                    {/* Cobertura del rol sobre el catálogo de permisos */}
                    <ITText as="span" className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <ITText
                        as="span"
                        className={`block h-1 rounded-full ${ROLE_TONES[roleTone(key)].dot}`}
                        style={{
                          width: `${Math.round((Object.keys(permissionsByRole[key] ?? {}).length / Math.max(1, catalogTotal)) * 100)}%`,
                        }}
                      />
                    </ITText>
                  </ITText>
                </ITFlex>
              );
            })}
          </ITStack>
        ))}
      </div>
      </ITFlex>
    </ITCard>
  );
}
