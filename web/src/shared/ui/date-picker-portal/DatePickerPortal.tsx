import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ITInput, ITText } from "@axzydev/axzy_ui_system";
import { FaCalendarAlt } from "react-icons/fa";
import { usePopoverPosition } from "./usePopoverPosition";
import { i18n } from "@shared/i18n";

/**
 * DatePickerPortal: selector de fecha portado a `document.body` para evitar
 * que contenedores con `overflow: hidden` o `transform` (ITStepper, ITDialog)
 * recorten o desplacen el calendario. Implementación propia, sin dependencia
 * del kit UI. Mantiene la misma API que ITDatePicker (un solo Date).
 */

const pad = (n: number) => String(n).padStart(2, "0");

const dateToStr = (value: Date | null | undefined): string => {
  if (!value) return "";
  const y = value.getFullYear();
  const m = pad(value.getMonth() + 1);
  const d = pad(value.getDate());
  return `${y}-${m}-${d}`;
};

const strToDate = (value: string): Date | null => {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export interface DatePickerPortalProps {
  name: string;
  label?: string;
  value?: Date | null;
  onChange: (event: {
    target: { name: string; value: Date | [Date | null, Date | null] };
  }) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  maxDate?: Date;
  minDate?: Date;
}

export default function DatePickerPortal({
  name,
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  maxDate,
  minDate,
}: DatePickerPortalProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const placement = usePopoverPosition({ triggerRef, popoverHeight: 360, open });

  const today = new Date();
  const seed = value ? new Date(value.getFullYear(), value.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [viewMonth, setViewMonth] = useState<Date>(seed);

  useEffect(() => {
    if (value) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [value]);

  // Cierra al hacer click fuera del trigger o del popover.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const popover = document.getElementById(`datepicker-popover-${name}`);
      if (popover?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, name]);

  const emit = (date: Date) => {
    onChange({ target: { name, value: date } });
    setOpen(false);
  };

  const inputValue = dateToStr(value ?? null);
  const minStr = minDate ? dateToStr(minDate) : undefined;
  const maxStr = maxDate ? dateToStr(maxDate) : undefined;

  const startWeekday = (new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday; i > 0; i--) {
    cells.push({ date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  const monthLabel = viewMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const popover =
    open && placement
      ? createPortal(
          <div
            id={`datepicker-popover-${name}`}
            style={{
              position: "fixed",
              top: placement.top,
              left: placement.left,
              zIndex: 9999,
              background: "var(--it-card-bg, #ffffff)",
              color: "var(--color-text-default)",
              border: "1px solid var(--it-card-border, #e2e8f0)",
              borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              padding: 12,
              width: 280,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                }
                style={{ fontSize: 18, color: "var(--color-text-muted, #64748b)", padding: "4px 8px" }}
                aria-label={i18n.t("common:datePicker.previousMonth")}
              >
                ‹
              </button>
              <ITText as="span" style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>
                {monthLabel}
              </ITText>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                }
                style={{ fontSize: 18, color: "var(--color-text-muted, #64748b)", padding: "4px 8px" }}
                aria-label={i18n.t("common:datePicker.nextMonth")}
              >
                ›
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                fontSize: 10,
                color: "var(--color-text-muted, #64748b)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                <div key={d} style={{ textAlign: "center", fontWeight: 700 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {cells.map((cell, i) => {
                const { date } = cell;
                const isSel = value && dateToStr(date) === dateToStr(value);
                const isToday = dateToStr(date) === dateToStr(new Date());
                const disabled =
                  (minStr && dateToStr(date) < minStr) ||
                  (maxStr && dateToStr(date) > maxStr);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!!disabled}
                    onClick={() => emit(date)}
                    style={{
                      padding: "6px 0",
                      borderRadius: 6,
                      border: isToday && !isSel ? "1px solid var(--color-text-muted, #94a3b8)" : "1px solid transparent",
                      cursor: disabled ? "not-allowed" : "pointer",
                      background: isSel ? "var(--color-primary)" : "transparent",
                      color: isSel ? "#ffffff" : disabled || !cell.inMonth ? "var(--color-text-muted, #94a3b8)" : "var(--color-text-default, #1e293b)",
                      fontWeight: isSel ? 700 : 500,
                      opacity: disabled ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel && !disabled)
                        (e.currentTarget as HTMLElement).style.background = "var(--color-primary-soft)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel && !disabled)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => emit(new Date())}
                style={{ fontSize: 11, color: "var(--color-text-default, #475569)" }}
              >
                {i18n.t("common:datePicker.today")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ fontSize: 11, color: "var(--color-text-default, #475569)" }}
              >
                {i18n.t("common:datePicker.close")}
              </button>
            </div>
            {/* Hidden native date input keeps the browser-native picker accessible. */}
            <input
              type="date"
              value={inputValue}
              min={minStr}
              max={maxStr}
              onChange={(e) => {
                const d = strToDate(e.target.value);
                if (d) emit(d);
              }}
              style={{ marginTop: 8, width: "100%", fontSize: 12 }}
              aria-label={i18n.t("common:datePicker.native", { label: label ?? name })}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={triggerRef} className={className} style={{ position: "relative" }}>
      <ITInput
        name={name}
        type="text"
        label={label}
        value={value ? value.toLocaleDateString("es-ES") : ""}
        onChange={() => {
          /* readOnly: ITInput requires onChange; no-op */
        }}
        readOnly
        disabled={disabled}
        required={required}
        onClick={() => !disabled && setOpen(true)}
        iconRight={
          <FaCalendarAlt
            className="text-slate-500 dark:text-slate-400 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setOpen(true);
            }}
          />
        }
      />
      {popover}
    </div>
  );
}
