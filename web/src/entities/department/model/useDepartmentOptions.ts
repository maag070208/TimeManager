import { useEffect, useMemo, useState } from "react";
import { departmentsApi } from "../api/departmentApi";

/**
 * Opciones del filtro Departamento de las tablas: todos, incluidos los
 * inactivos (siguen teniendo registros). `byName` usa el nombre como id, para
 * tablas que guardan el departamento como texto.
 */
export const useDepartmentOptions = ({ byName = false }: { byName?: boolean } = {}) => {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    departmentsApi
      .list(true)
      .then((list) => {
        if (!active) return;
        setOptions(list.map((d) => ({ id: byName ? d.name : d.id, name: d.name })));
        setError(false);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [byName]);

  /** Listo para `catalogOptions` de ITDataTable. */
  return useMemo(() => ({ data: options, loading, error }), [options, loading, error]);
};
