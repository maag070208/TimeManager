import { useCallback, useEffect, useState } from "react";
import {
  permissionApi,
  type PolicyAdmin,
  type PolicyCreateDto,
  type PolicyListData,
  type PolicyUpdateDto,
} from "@entities/permission";
import { i18n } from "@shared/i18n";
import type { RoleResult } from "./useRolesAdmin";

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { message?: string })?.message ?? fallback;

export interface PoliciesState {
  data: PolicyListData | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  reload: () => Promise<void>;
  create: (dto: PolicyCreateDto) => Promise<RoleResult>;
  update: (id: string, dto: PolicyUpdateDto) => Promise<RoleResult>;
  remove: (id: string) => Promise<RoleResult>;
  /** Activa o desactiva una regla sin abrir el editor. */
  setActive: (policy: PolicyAdmin, active: boolean) => Promise<RoleResult>;
  /**
   * Sube o baja una regla en el orden de revisión de su acción: intercambia su
   * prioridad con la vecina (`rules` ya viene ordenada por prioridad).
   */
  move: (rules: readonly PolicyAdmin[], index: number, direction: -1 | 1) => Promise<RoleResult>;
}

/** Políticas ABAC y catálogo de acciones con sus campos (`GET /permissions/policies`). */
export const usePolicies = (): PoliciesState => {
  const [data, setData] = useState<PolicyListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await permissionApi.getPolicies());
    } catch (err) {
      setError(errorMessage(err, i18n.t("roles:policies.loadError")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<RoleResult> => {
      setSaving(true);
      try {
        await action();
        await reload();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err, i18n.t("roles:policies.saveError")) };
      } finally {
        setSaving(false);
      }
    },
    [reload]
  );

  const create = useCallback((dto: PolicyCreateDto) => run(() => permissionApi.createPolicy(dto)), [run]);
  const update = useCallback(
    (id: string, dto: PolicyUpdateDto) => run(() => permissionApi.updatePolicy(id, dto)),
    [run]
  );
  const remove = useCallback((id: string) => run(() => permissionApi.deletePolicy(id)), [run]);

  const setActive = useCallback(
    (policy: PolicyAdmin, active: boolean) => run(() => permissionApi.updatePolicy(policy.id, { active })),
    [run]
  );

  const move = useCallback(
    (rules: readonly PolicyAdmin[], index: number, direction: -1 | 1) => {
      const current = rules[index];
      const neighbor = rules[index + direction];
      if (!current || !neighbor) return Promise.resolve<RoleResult>({ ok: true });
      return run(async () => {
        if (current.priority !== neighbor.priority) {
          // Intercambio simple de prioridades.
          await permissionApi.updatePolicy(current.id, { priority: neighbor.priority });
          await permissionApi.updatePolicy(neighbor.id, { priority: current.priority });
          return;
        }
        // Empatadas: la que se mueve queda una unidad antes o después de la vecina.
        const target = neighbor.priority + direction;
        if (target >= 0) {
          await permissionApi.updatePolicy(current.id, { priority: target });
        } else {
          await permissionApi.updatePolicy(current.id, { priority: 0 });
          await permissionApi.updatePolicy(neighbor.id, { priority: 1 });
        }
      });
    },
    [run]
  );

  return { data, loading, error, saving, reload, create, update, remove, setActive, move };
};
