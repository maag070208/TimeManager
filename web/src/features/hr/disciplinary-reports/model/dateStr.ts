/** Fecha local como `YYYY-MM-DD` (sin pasar por UTC, para no correr el día). */
export const localToDateStr = (value: Date): string => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
