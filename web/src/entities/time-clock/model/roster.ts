/** Persona del reloj sin vínculo a un usuario (NUEVO). */
export interface RosterPerson {
  employeeNumber: string;
  name: string;
  clocks: string[];
}

/** Persona vinculada con baja pendiente (espera motivo). */
export interface RosterPendingRemoval {
  employeeNumber: string;
  userId: string;
  userName: string;
  missingSince: string | null;
}

/** Usuario ya dado de baja que reapareció en el reloj. */
export interface RosterReappeared {
  employeeNumber: string;
  userId: string;
  userName: string;
  reappearedAt: string | null;
}

export interface RosterClockResult {
  serial: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface RosterRun {
  id: string;
  trigger: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  suspicious: boolean;
  added: number;
  removalPending: number;
  cancelled: number;
  reappeared: number;
  perClock: RosterClockResult[];
}

export interface TimeClockRoster {
  lastRun: RosterRun | null;
  unlinked: RosterPerson[];
  pendingRemovals: RosterPendingRemoval[];
  reappeared: RosterReappeared[];
}

/** Motivo de baja del catálogo `removal_categories` (la API lo administra). */
export interface RemovalCategoryRow {
  id: string;
  key: string;
  name: string;
  active: boolean;
}

export interface RosterRemovalInput {
  categoryId: string;
  reason: string;
  notifyUser: boolean;
}

/** Resultado de `POST /time-clock/roster/run`. */
export interface RosterRunResult {
  ok: boolean;
  suspicious: boolean;
  added: number;
  removalPending: number;
  cancelled: number;
  reappeared: number;
  newCount: number;
  perClock: RosterClockResult[];
}
