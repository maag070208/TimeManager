import { useEffect, useMemo, useState } from "react";
import { usersApi } from "../api/userApi";
import type { UserRole } from "./types";

export interface PersonOption {
  id: string;
  name: string;
}

/** "Nombre #número" (así se distingue a homónimos en los filtros). */
export const personLabel = (u: { name: string; employeeNumber?: string | null }) =>
  u.employeeNumber ? `${u.name} #${u.employeeNumber}` : u.name;

/**
 * Opciones de los filtros de persona (Responsable, Empleado, Asignado a,
 * Guardia…): todas las personas, incluidas las dadas de baja, que siguen
 * teniendo registros. `roles` acota (p. ej. solo GUARD).
 */
export const usePeopleOptions = (roles?: UserRole[]) => {
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const rolesKey = roles?.join(",") ?? "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    usersApi
      .people(rolesKey ? (rolesKey.split(",") as UserRole[]) : undefined)
      .then((list) => {
        if (!active) return;
        setOptions(list.map((u) => ({ id: u.id, name: personLabel(u) })).sort((a, b) => a.name.localeCompare(b.name)));
        setError(false);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [rolesKey]);

  /** Listo para `catalogOptions` de ITDataTable. */
  return useMemo(() => ({ data: options, loading, error }), [options, loading, error]);
};
