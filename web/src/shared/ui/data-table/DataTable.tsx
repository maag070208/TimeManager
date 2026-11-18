import { ITDataTable, ITSkeleton, type ITDataTableProps } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";

/** Filas fantasma: el indicador de carga de las tablas (en lugar del spinner del design system). */
const TableSkeleton = () => {
  const { t } = useTranslation("common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex w-64 max-w-full flex-col gap-2.5">
      {[100, 82, 92, 70].map((width) => (
        <ITSkeleton key={width} variant="rectangular" height={14} width={`${width}%`} className="rounded-md" />
      ))}
    </div>
  );
};

/** `ITDataTable` con el esqueleto de la app como indicador de carga. */
export default function DataTable<T extends Record<string, unknown>>(props: ITDataTableProps<T>) {
  return <ITDataTable<T> loadingIndicator={<TableSkeleton />} {...props} />;
}
