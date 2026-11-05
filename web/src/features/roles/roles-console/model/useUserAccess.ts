import { useCallback, useEffect, useState } from "react";
import {
  permissionApi,
  type AccessSimulation,
  type SimulationDto,
  type UserAccessView,
} from "@entities/permission";
import { i18n } from "@shared/i18n";

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { message?: string })?.message ?? fallback;

export interface UserAccessState {
  access: UserAccessView | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Acceso efectivo de una persona, calculado por la API con el mismo resolvedor
 * que usan las rutas (`GET /permissions/members/:id/access`).
 */
export const useUserAccess = (userId: string | null, refreshKey = 0): UserAccessState => {
  const [access, setAccess] = useState<UserAccessView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setAccess(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAccess(await permissionApi.getMemberAccess(userId));
    } catch (err) {
      setError(errorMessage(err, i18n.t("roles:errors.access")));
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { access, loading, error, reload };
};

export interface AccessSimulatorState {
  result: AccessSimulation | null;
  running: boolean;
  error: string | null;
  run: (dto: SimulationDto) => Promise<void>;
  reset: () => void;
}

/** Probador Identidad → RBAC → ABAC (`POST /permissions/simulate`). */
export const useAccessSimulator = (): AccessSimulatorState => {
  const [result, setResult] = useState<AccessSimulation | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (dto: SimulationDto) => {
    setRunning(true);
    setError(null);
    try {
      setResult(await permissionApi.simulate(dto));
    } catch (err) {
      setError(errorMessage(err, i18n.t("roles:errors.simulate")));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, running, error, run, reset };
};
