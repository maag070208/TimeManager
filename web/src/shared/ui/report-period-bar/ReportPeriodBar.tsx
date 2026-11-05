import { useState } from "react";
import { ITButton, ITDatePicker, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuRotateCcw } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { FilterPills } from "@shared/ui/filter-pills";

type DateRange = [Date | null, Date | null];
type Preset = "all" | "last7" | "last30" | "month" | "custom";

interface Props {
  /** Prefijo único del `name` del selector de fechas. */
  name: string;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Periodo de un reporte (plantilla P6): píldoras con rangos rápidos y, a la
 * derecha, el selector de rango libre. "Todo" deja el rango vacío.
 */
export default function ReportPeriodBar({ name, dateRange, setDateRange }: Props) {
  const { t } = useTranslation("reports");
  const [preset, setPreset] = useState<Preset>("all");

  const apply = (value: Preset) => {
    setPreset(value);
    const today = startOfDay(new Date());
    if (value === "all") return setDateRange([null, null]);
    if (value === "month") return setDateRange([new Date(today.getFullYear(), today.getMonth(), 1), today]);
    if (value === "last7" || value === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - (value === "last7" ? 6 : 29));
      setDateRange([start, today]);
    }
  };

  const handleDateRange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: Date | [Date | null, Date | null] } },
  ) => {
    const value = e.target.value;
    if (Array.isArray(value)) {
      setPreset(value[0] || value[1] ? "custom" : "all");
      setDateRange(value);
    }
  };

  return (
    <ITFlex align="end" wrap="wrap" gap={3}>
      <FilterPills
        items={[
          { id: "all" as Preset, label: t("filters.presetAll") },
          { id: "last7" as Preset, label: t("filters.preset7") },
          { id: "last30" as Preset, label: t("filters.preset30") },
          { id: "month" as Preset, label: t("filters.presetMonth") },
        ]}
        value={preset}
        onChange={apply}
      />
      <div className="min-w-[240px] max-w-[340px] flex-1">
        <ITDatePicker
          name={name}
          label={t("filters.dateRange")}
          range
          value={dateRange}
          onChange={handleDateRange}
          className="w-full min-w-0"
        />
      </div>
      <ITButton
        variant="text"
        color="gray"
        size="sm"
        onClick={() => apply("all")}
        disabled={!dateRange[0] && !dateRange[1]}
      >
        <ITFlex align="center" gap={1}>
          <LuRotateCcw size={12} />
          <ITText className="font-bold text-[11px]">{t("filters.clear")}</ITText>
        </ITFlex>
      </ITButton>
    </ITFlex>
  );
}
