// API pública del slice "sys-config". Nada fuera de esta carpeta debe
// importar directo desde api/ — todo pasa por este barrel.
export { sysConfigApi, type SysConfig } from "./api/sysConfigApi";
export {
  WEEKDAYS,
  DEFAULT_WEEK_START_DAY,
  isWeekday,
  weekdayIndex,
  loadWeekStartDay,
  invalidateWeekStartDay,
  useWeekStartDay,
  type Weekday,
} from "./model/weekStartDay";