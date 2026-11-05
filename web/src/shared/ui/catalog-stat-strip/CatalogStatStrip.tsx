import { useEffect, useState } from "react";
import { ITBentoStatStrip } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";

interface Props {
  /** Lista completa del catálogo (incluye inactivos). */
  load: () => Promise<Array<{ active: boolean }>>;
  /** Cambia para recargar las cifras después de alta/baja. */
  reloadKey?: unknown;
}

/**
 * Cifras de un catálogo en la tira del mosaico: total, activos e inactivos.
 * Se calculan con la misma lista que alimenta la tabla, así nunca se
 * desfasan con lo que se ve.
 */
export default function CatalogStatStrip({ load, reloadKey }: Props) {
  const { t } = useTranslation(["catalog", "common"]);
  const [items, setItems] = useState<Array<{ active: boolean }> | null>(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  if (!items) return null;

  const active = items.filter((i) => i.active).length;

  return (
    <ITBentoStatStrip
      items={[
        { id: "all", label: t("stats.total"), value: items.length, tone: "sea", color: "var(--color-primary-600)" },
        { id: "active", label: t("stats.active"), value: active, tone: "mint", color: "var(--color-success)" },
        { id: "inactive", label: t("stats.inactive"), value: items.length - active, tone: "sun", color: "var(--color-warning)" },
      ]}
    />
  );
}
