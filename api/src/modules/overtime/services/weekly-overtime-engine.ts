import {
  DAILY_OVERTIME_LIMIT_MINUTES,
  MAX_OVERTIME_DAYS_PER_WEEK,
  WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES,
  weeklyLimitForYear,
  weeklyOvertimeLimitForYear,
} from "@modules/nom/services/nom-settings.service";

/**
 * Motor semanal de horas extra (F1, plan de cumplimiento LFT 2026).
 *
 * Clasifica cada minuto extra de una semana en DOBLE, TRIPLE o EXCEDENTE
 * ILEGAL aplicando el decreto publicado el 01-may-2026:
 * - ordinaria 48/46/44/42/40 h según el año (transitorio 2.º),
 * - extra al doble 9/9/10/11/12 h por semana (transitorio 4.º),
 * - máximo 4 h de extra por día y 4 días con extra por semana (art. 66),
 * - excedente al triple de hasta 4 h por semana (art. 68),
 * - la jornada ordinaria + extra nunca pasa de 12 h en un día (art. 68),
 * - menores de 18 no hacen extra (art. 178) y se marca infracción.
 *
 * Es una función pura: no toca la base de datos y guarda el resultado en un
 * snapshot (`WeeklyOvertimeLedger`) para que el cálculo sea auditable.
 */

export const OVERTIME_ENGINE_VERSION = "weekly-ot-v1";
const DAILY_TOTAL_LIMIT_MINUTES = 12 * 60;

export type WeeklyOvertimeShift = "DIURNA" | "NOCTURNA" | "MIXTA";

export type WeeklyOvertimeViolation =
  | "HORARIO_ILEGAL"
  | "EXCEDENTE_ILEGAL"
  | "TOPE_DIARIO_12H"
  | "MENOR"
  | "SIN_DIA_DE_DESCANSO";

export interface WeeklyOvertimeDayInput {
  /** Día local `YYYY-MM-DD`. */
  date: string;
  workedMin: number;
  /** Jornada pactada del día (ya sin lactancia si aplica). */
  scheduledMin: number;
  shiftType?: WeeklyOvertimeShift;
  restDay?: boolean;
  /** Día festivo laborado (bolsa separada, art. 74/75). */
  holidayWorked?: boolean;
  sunday?: boolean;
}

export interface WeeklyOvertimeInput {
  days: WeeklyOvertimeDayInput[];
  /** Edad al inicio de la semana (null/undefined = adulto o desconocida). */
  ageAtWeekStart?: number | null;
  /** Días consecutivos trabajados al cierre de la semana (art. 69). */
  consecutiveWorkedDays?: number;
  /** Convenio de distribución del art. 58: permite pasar del máximo diario. */
  hasDistributionAgreement?: boolean;
}

export interface WeeklyOvertimeDayResult {
  date: string;
  workedMin: number;
  /** Jornada ordinaria efectiva del día (aplicando el máximo del art. 61). */
  scheduledMin: number;
  ordinaryMin: number;
  extraMin: number;
  doubleMin: number;
  tripleMin: number;
  illegalMin: number;
  restDayWorkedMin: number;
  holidayWorkedMin: number;
  sunday: boolean;
  violations: WeeklyOvertimeViolation[];
}

export interface WeeklyOvertimeLegalContext {
  year: number;
  weeklyLimitMinutes: number;
  doubleLimitMinutes: number;
  tripleLimitMinutes: number;
  dailyOvertimeLimitMinutes: number;
  maxOvertimeDaysPerWeek: number;
  dailyTotalLimitMinutes: number;
}

export interface WeeklyOvertimeResult {
  year: number;
  ordinaryMin: number;
  otDoubleMin: number;
  otTripleMin: number;
  otIllegalMin: number;
  restDayWorkedMin: number;
  holidayWorkedMin: number;
  sundayWorked: boolean;
  minor: boolean;
  violations: WeeklyOvertimeViolation[];
  days: WeeklyOvertimeDayResult[];
  engineVersion: string;
  legal: WeeklyOvertimeLegalContext;
}

/** Máximo diario del art. 61 por tipo de turno, en minutos. */
export const shiftDailyLimitMinutes = (shift: WeeklyOvertimeShift = "DIURNA"): number => {
  if (shift === "NOCTURNA") return 7 * 60;
  if (shift === "MIXTA") return 7 * 60 + 30;
  return 8 * 60;
};

const yearOf = (date: string): number => Number(date.slice(0, 4));

const weekdayOf = (date: string): number => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

const addViolation = (
  list: WeeklyOvertimeViolation[],
  violation: WeeklyOvertimeViolation
): void => {
  if (!list.includes(violation)) list.push(violation);
};

/**
 * Calcula la semana. Los días se procesan en orden cronológico y los minutos
 * extra se asignan primero al doble, luego al triple y lo que sobra se marca
 * como excedente ilegal (se paga igual, pero genera infracción).
 */
export const classifyWeeklyOvertime = (input: WeeklyOvertimeInput): WeeklyOvertimeResult => {
  const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  const minor = input.ageAtWeekStart != null && input.ageAtWeekStart < 18;
  const violations: WeeklyOvertimeViolation[] = [];

  if (days.length === 0) {
    const year = new Date().getUTCFullYear();
    return {
      year,
      ordinaryMin: 0,
      otDoubleMin: 0,
      otTripleMin: 0,
      otIllegalMin: 0,
      restDayWorkedMin: 0,
      holidayWorkedMin: 0,
      sundayWorked: false,
      minor,
      violations: minor ? ["MENOR"] : [],
      days: [],
      engineVersion: OVERTIME_ENGINE_VERSION,
      legal: {
        year,
        weeklyLimitMinutes: weeklyLimitForYear(year),
        doubleLimitMinutes: weeklyOvertimeLimitForYear(year),
        tripleLimitMinutes: WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES,
        dailyOvertimeLimitMinutes: DAILY_OVERTIME_LIMIT_MINUTES,
        maxOvertimeDaysPerWeek: MAX_OVERTIME_DAYS_PER_WEEK,
        dailyTotalLimitMinutes: DAILY_TOTAL_LIMIT_MINUTES,
      },
    };
  }

  const year = yearOf(days[0].date);
  // Semana que cruza el 1 de enero: se toma la jornada ordinaria más
  // favorable al trabajador (la menor) y los topes de extra del año de inicio.
  const ordinaryCap = Math.min(
    ...days.map((day) => weeklyLimitForYear(yearOf(day.date)))
  );
  const doubleCap = weeklyOvertimeLimitForYear(year);
  const tripleCap = WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES;

  let scheduledTotal = 0;
  let ordinaryTotal = 0;
  let restDayWorkedMin = 0;
  let holidayWorkedMin = 0;
  let sundayWorked = false;

  const detail: Array<WeeklyOvertimeDayResult & { candidateExtraMin: number }> = days.map((day) => {
    const rest = day.restDay === true;
    const holiday = day.holidayWorked === true;
    const sunday = day.sunday === true || weekdayOf(day.date) === 7;
    const worked = Math.max(0, day.workedMin);
    let scheduled = Math.max(0, day.scheduledMin);

    if (!rest && !input.hasDistributionAgreement) {
      scheduled = Math.min(scheduled, shiftDailyLimitMinutes(day.shiftType));
    }

    const row: WeeklyOvertimeDayResult & { candidateExtraMin: number } = {
      date: day.date,
      workedMin: worked,
      scheduledMin: scheduled,
      ordinaryMin: 0,
      candidateExtraMin: 0,
      extraMin: 0,
      doubleMin: 0,
      tripleMin: 0,
      illegalMin: 0,
      restDayWorkedMin: 0,
      holidayWorkedMin: 0,
      sunday,
      violations: [],
    };

    if (sunday && worked > 0) sundayWorked = true;

    if (rest) {
      row.restDayWorkedMin = worked;
      restDayWorkedMin += worked;
      return row;
    }

    if (holiday) {
      row.holidayWorkedMin = worked;
      holidayWorkedMin += worked;
      return row;
    }

    const ordinary = Math.min(worked, scheduled);
    row.ordinaryMin = ordinary;
    row.candidateExtraMin = Math.max(0, worked - scheduled);
    scheduledTotal += scheduled;
    ordinaryTotal += ordinary;
    return row;
  });

  // Reclasificación semanal (art. 59): si lo ordinario de la semana rebasa la
  // jornada máxima del año, el excedente se vuelve extra de los últimos días.
  if (ordinaryTotal > ordinaryCap) {
    let excess = ordinaryTotal - ordinaryCap;
    for (let i = detail.length - 1; i >= 0 && excess > 0; i -= 1) {
      const day = detail[i];
      if (day.ordinaryMin <= 0) continue;
      const moved = Math.min(day.ordinaryMin, excess);
      day.ordinaryMin -= moved;
      day.candidateExtraMin += moved;
      ordinaryTotal -= moved;
      excess -= moved;
    }
    addViolation(violations, "HORARIO_ILEGAL");
  }

  if (scheduledTotal > ordinaryCap) addViolation(violations, "HORARIO_ILEGAL");
  if ((input.consecutiveWorkedDays ?? 0) >= 7) addViolation(violations, "SIN_DIA_DE_DESCANSO");
  if (minor) addViolation(violations, "MENOR");

  let doubleTotal = 0;
  let tripleTotal = 0;
  let illegalTotal = 0;
  let extraDays = 0;

  for (const day of detail) {
    const candidate = day.candidateExtraMin;
    if (candidate <= 0) continue;

    // La jornada ordinaria + extra nunca puede pasar de 12 h en el día.
    const dailyRoom = Math.max(0, DAILY_TOTAL_LIMIT_MINUTES - day.ordinaryMin);
    const allowed = Math.min(candidate, dailyRoom);
    const overDaily = candidate - allowed;
    if (overDaily > 0) {
      day.illegalMin += overDaily;
      illegalTotal += overDaily;
      addViolation(day.violations, "TOPE_DIARIO_12H");
      addViolation(violations, "TOPE_DIARIO_12H");
    }
    if (allowed <= 0) {
      day.extraMin = overDaily;
      continue;
    }

    extraDays += 1;
    let remaining = allowed;

    const doubleEligible =
      !minor &&
      extraDays <= MAX_OVERTIME_DAYS_PER_WEEK &&
      doubleTotal < doubleCap;
    if (doubleEligible) {
      const doubleMin = Math.min(
        remaining,
        DAILY_OVERTIME_LIMIT_MINUTES,
        doubleCap - doubleTotal
      );
      day.doubleMin += doubleMin;
      doubleTotal += doubleMin;
      remaining -= doubleMin;
    }

    if (remaining > 0) {
      const tripleMin = Math.min(remaining, tripleCap - tripleTotal);
      day.tripleMin += tripleMin;
      tripleTotal += tripleMin;
      remaining -= tripleMin;
    }

    if (remaining > 0) {
      day.illegalMin += remaining;
      illegalTotal += remaining;
      addViolation(day.violations, "EXCEDENTE_ILEGAL");
      addViolation(violations, "EXCEDENTE_ILEGAL");
    }

    day.extraMin = day.doubleMin + day.tripleMin + day.illegalMin;
  }

  return {
    year,
    ordinaryMin: ordinaryTotal,
    otDoubleMin: doubleTotal,
    otTripleMin: tripleTotal,
    otIllegalMin: illegalTotal,
    restDayWorkedMin,
    holidayWorkedMin,
    sundayWorked,
    minor,
    violations,
    days: detail.map(({ candidateExtraMin: _candidate, ...row }) => row),
    engineVersion: OVERTIME_ENGINE_VERSION,
    legal: {
      year,
      weeklyLimitMinutes: ordinaryCap,
      doubleLimitMinutes: doubleCap,
      tripleLimitMinutes: tripleCap,
      dailyOvertimeLimitMinutes: DAILY_OVERTIME_LIMIT_MINUTES,
      maxOvertimeDaysPerWeek: MAX_OVERTIME_DAYS_PER_WEEK,
      dailyTotalLimitMinutes: DAILY_TOTAL_LIMIT_MINUTES,
    },
  };
};
