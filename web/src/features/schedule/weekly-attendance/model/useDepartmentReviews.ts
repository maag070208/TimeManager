import { useCallback, useEffect, useState } from "react";
import { scheduleApi, type PayrollReviewState } from "@entities/schedule";

/**
 * La revisión por departamento y el cierre de la pre-nómina, ya en el API
 * (`/schedules/payroll/*`): quedan quién revisó cada departamento, cuándo, si
 * fue una por una o con «marcar todo» (`bulk`), y el cierre de la semana con
 * su fotografía de cifras. La clave de la semana es su primer día.
 */
export const useDepartmentReviews = (weekKey: string | null) => {
  const [state, setState] = useState<PayrollReviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Otra semana: su propio estado de revisión.
  useEffect(() => {
    if (!weekKey) {
      setState(null);
      return;
    }
    let cancelled = false;
    scheduleApi
      .payrollReviewState(weekKey)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [weekKey]);

  const run = useCallback((action: () => Promise<PayrollReviewState>) => {
    setBusy(true);
    setError(null);
    action()
      .then(setState)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }, []);

  /** Marca o desmarca un departamento como revisado. */
  const toggle = useCallback(
    (departmentId: string | null) => {
      if (!weekKey) return;
      const reviewed = !(state?.reviews.some((r) => r.departmentId === departmentId) ?? false);
      run(() => scheduleApi.payrollSetReview({ weekStart: weekKey, departmentId, reviewed }));
    },
    [weekKey, state, run]
  );

  /** «Marcar todo como revisado». */
  const reviewAll = useCallback(
    (departmentIds: (string | null)[]) => {
      if (!weekKey) return;
      run(() => scheduleApi.payrollReviewAll({ weekStart: weekKey, departmentIds }));
    },
    [weekKey, run]
  );

  /** Cierra la semana con la fotografía de sus cifras. */
  const close = useCallback(
    (departmentIds: (string | null)[], snapshot: Record<string, unknown>) => {
      if (!weekKey) return;
      run(() => scheduleApi.payrollClose({ weekStart: weekKey, departmentIds, snapshot }));
    },
    [weekKey, run]
  );

  const reopen = useCallback(() => {
    if (!weekKey) return;
    run(() => scheduleApi.payrollReopen(weekKey));
  }, [weekKey, run]);

  const isReviewed = useCallback(
    (departmentId: string | null) => state?.reviews.some((r) => r.departmentId === departmentId) ?? false,
    [state]
  );

  /** La revisión de un departamento (quién, cuándo, una por una o todas). */
  const reviewOf = useCallback(
    (departmentId: string | null) => state?.reviews.find((r) => r.departmentId === departmentId) ?? null,
    [state]
  );

  return {
    reviewedCount: state?.reviews.length ?? 0,
    isReviewed,
    reviewOf,
    toggle,
    reviewAll,
    closed: state?.closed ?? false,
    /** Sello del cierre vigente (quién y cuándo cerró/reabrió). */
    closure: state?.closure ?? null,
    close,
    reopen,
    busy,
    error,
    clearError: () => setError(null),
  };
};

export type UseDepartmentReviews = ReturnType<typeof useDepartmentReviews>;
