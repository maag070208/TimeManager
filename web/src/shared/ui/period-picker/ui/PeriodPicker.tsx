import { useMemo } from "react";
import { ITButton, ITDatePicker, ITFlex, ITSegmentedControl } from "@axzydev/axzy_ui_system";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { REPORT_PERIODS, type ReportPeriod } from "@shared/lib/reportPeriod";

export interface PeriodPickerLabels {
  /** Etiqueta de cada periodo en el segmentado. */
  periods: Record<ReportPeriod, string>;
  date: string;
  previous: string;
  next: string;
}

export interface PeriodPickerProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  /** Día de referencia (periodo diario). */
  date: Date;
  /** `[inicio, fin]` del periodo (periodos de varios días). */
  range: [Date, Date];
  onDateChange: (date: Date) => void;
  onPrevious: () => void;
  onNext: () => void;
  labels: PeriodPickerLabels;
  /** Prefijo de los `name` de los campos (único por pantalla). */
  name?: string;
}

type PickerChange =
  | React.ChangeEvent<HTMLInputElement>
  | { target: { name: string; value: Date | [Date | null, Date | null] } };

/** Segmentado de periodo + `[<] fecha o rango [>]`, compartido por los reportes con periodos. */
export default function PeriodPicker({
  period,
  onPeriodChange,
  date,
  range,
  onDateChange,
  onPrevious,
  onNext,
  labels,
  name = "period",
}: PeriodPickerProps) {
  const periodOptions = useMemo(
    () => REPORT_PERIODS.map((value) => ({ value, label: labels.periods[value] })),
    [labels.periods]
  );

  const handleDate = (e: PickerChange) => {
    const value = e.target.value;
    if (value instanceof Date) onDateChange(value);
  };

  const handleRange = (e: PickerChange) => {
    const value = e.target.value;
    if (Array.isArray(value) && value[0]) onDateChange(value[0]);
  };

  return (
    <>
      <ITSegmentedControl
        options={periodOptions}
        value={period}
        onChange={(value) => onPeriodChange(value as ReportPeriod)}
      />
      <ITFlex align="end" gap={2} className="min-w-[280px] flex-1">
        <ITButton variant="outlined" color="gray" onClick={onPrevious} title={labels.previous}>
          <FaChevronLeft size={11} />
        </ITButton>
        <ITFlex className="min-w-0 flex-1">
          {period === "DAY" ? (
            <ITDatePicker
              name={`${name}Date`}
              label={labels.date}
              value={date}
              onChange={handleDate}
              className="w-full min-w-0"
            />
          ) : (
            <ITDatePicker
              name={`${name}DateRange`}
              label={labels.date}
              range
              value={range}
              onChange={handleRange}
              className="w-full min-w-0"
            />
          )}
        </ITFlex>
        <ITButton variant="outlined" color="gray" onClick={onNext} title={labels.next}>
          <FaChevronRight size={11} />
        </ITButton>
      </ITFlex>
    </>
  );
}
