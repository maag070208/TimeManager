/** Cómo se identificó el empleado en el reloj (derivado del `minor` ISAPI). */
export type PunchMethod = "FACE" | "FINGERPRINT" | "CARD" | "OTHER";

/**
 * Checada copiada de un reloj Hikvision (ver CHECADOR.md). La API solo LEE de
 * los relojes: estas filas llegan por la sincronización periódica y son
 * inmutables.
 */
export interface TimeClockPunch {
  id: string;
  clockSerial: string;
  /** Nombre del reloj donde se checó (`null` si el reloj no tiene nombre). */
  clock: string | null;
  /** Consecutivo del evento en el reloj. */
  serialNo: number;
  employeeNumber: string;
  name: string;
  method: PunchMethod;
  /** Código `minor` ISAPI (75 rostro, 38 huella, 1 tarjeta; 104 = intento no válido). */
  minor: number;
  /** Instante de la checada según el reloj. */
  occurredAt: string;
  createdAt: string;
}

/** Una corrida de sincronización (`POST /checador/sync` y `ultimaCorrida`). */
export interface TimeClockRun {
  ok: boolean;
  clockSerial: string | null;
  startedAt: string;
  finishedAt: string;
  /** Eventos del reloj revisados (por consecutivo); de ellos solo se leen las checadas. */
  readCount: number;
  /** Checadas nuevas guardadas. */
  newCount: number;
  lastSerialNo: number | null;
  error: string | null;
}

/**
 * Avance de la corrida en curso (p. ej. la carga inicial del historial), en
 * eventos del reloj (consecutivos); de ellos solo se leen las checadas.
 */
export interface TimeClockProgress {
  startedAt: string;
  /** Eventos del reloj ya revisados. */
  readCount: number;
  newCount: number;
  /** Eventos del reloj que faltan; `null` hasta que el reloj da la cota. */
  remaining: number | null;
  /** Eventos del reloj a revisar en la corrida. */
  total: number | null;
}

/**
 * Importación manual por rango de fechas (`POST /checador/import`): la que está
 * en curso o la última. En curso mientras `finishedAt` es null; terminó bien si
 * además `error` es null.
 */
export interface TimeClockImport {
  /** Días `YYYY-MM-DD` del rango, inclusive. */
  from: string;
  to: string;
  startedAt: string;
  finishedAt: string | null;
  /** Checadas del rango en los relojes (se conoce al empezar a leer cada uno). */
  total: number | null;
  /** Checadas leídas del rango. */
  readCount: number;
  newCount: number;
  error: string | null;
}

/** Un reloj dado de alta y el estado de su sincronización. */
export interface TimeClockDevice {
  clockSerial: string;
  name: string;
  /** Dirección con la que la API se conecta (`https://192.168.1.132`). */
  url: string;
  /**
   * Si sus checadas arman las entradas/salidas (y las horas extra). Los relojes
   * de puertas de oficina, que se checan varias veces por turno, no.
   */
  countsAttendance: boolean;
  /** Si el sistema puede escribir en este reloj (altas, bajas, huellas). Apagado por defecto. */
  writeEnabled: boolean;
  model: string | null;
  lastSerialNo: number;
  syncedAt: string | null;
  punches: number;
  lastPunch: string | null;
  /** Corrida en curso de este reloj (p. ej. la carga inicial de su historial). */
  inProgress: TimeClockProgress | null;
  lastRun: TimeClockRun | null;
  /** El reloj rechazó la contraseña: su sincronización automática se detuvo. */
  pausedByCredentials: boolean;
}

/** Estado de la sincronización con los relojes (`GET /checador/status`). */
export interface TimeClockStatus {
  /** `false` si la API no tiene `CHECADOR_USER`: no se conecta a los relojes. */
  configured: boolean;
  /** Suma de las corridas en curso de todos los relojes. */
  inProgress: TimeClockProgress | null;
  /** Importación manual en curso o la última (de todos los relojes). */
  importJob: TimeClockImport | null;
  /** Relojes dados de alta. */
  devices: TimeClockDevice[];
}

/**
 * Configuración de un reloj leída en vivo del equipo
 * (`GET /checador/relojes/:serie/configuracion`). Solo lectura. `hora` y
 * `personas` quedan en `null` si el reloj no las pudo dar.
 */
export interface TimeClockConfig {
  clockSerial: string;
  readAt: string;
  device: {
    /** Nombre configurado en el propio reloj. */
    name: string | null;
    model: string | null;
    firmware: string | null;
    mac: string | null;
  };
  hour: {
    /** Hora del reloj con su offset, como la reporta (`2026-09-24T13:39:19-07:00`). */
    localTime: string;
    /** `manual` o `NTP`. */
    mode: string | null;
    /** Zona POSIX del reloj (`CST+7:00:00` = UTC−7). */
    zone: string | null;
    /** Reloj − servidor, en segundos (positivo = el reloj va adelantado). */
    driftSeconds: number;
  } | null;
  people: {
    total: number;
    withFace: number;
    withFingerprint: number;
    withCard: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Vinculación número del reloj ↔ usuario (POST /checador/empleados/query …)
// ---------------------------------------------------------------------------

/** Usuario del sistema al que apunta (o podría apuntar) un número del reloj. */
export interface TimeClockUserRef {
  userId: string;
  name: string;
  employeeNumber: string | null;
  active: boolean;
}

/**
 * `ALTA`: coinciden el nombre y el número de nómina (sin el prefijo de área del
 * reloj). `MEDIA`: solo el nombre; conviene revisar el número.
 */
export type TimeClockConfidence = "HIGH" | "MEDIUM";

export type TimeClockEmployeeStatus = "LINKED" | "UNLINKED" | "SUGGESTED";

/** Empleado dado de alta en el reloj (visto en sus checadas) y su vínculo. */
export interface TimeClockEmployee {
  /** Número del empleado en el reloj (la llave del vínculo). */
  employeeNumber: string;
  /** Nombre como está en el reloj. */
  name: string;
  punches: number;
  lastPunch: string;
  link: TimeClockUserRef | null;
  suggestion: (TimeClockUserRef & { confidence: TimeClockConfidence }) | null;
}

export interface TimeClockEmployeesSummary {
  total: number;
  linkedCount: number;
  withoutLink: number;
  /** Sin vincular con sugerencia `ALTA` (las que vincula el botón masivo). */
  registrationSuggestions: number;
}

export interface TimeClockEmployeesResponse {
  data: TimeClockEmployee[];
  total: number;
  summary: TimeClockEmployeesSummary;
}

/** Quién disparó un intento de sincronización. */
export type TimeClockSyncTrigger = "AUTO" | "MANUAL" | "IMPORT" | "REGISTER";

/** Un intento de sincronización con el reloj: un renglón del timeline. */
export interface TimeClockSyncEvent {
  id: string;
  trigger: TimeClockSyncTrigger;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  /** Eventos del reloj revisados (por consecutivo); de ellos, las checadas. */
  readCount: number;
  /** Checadas nuevas guardadas en este intento. */
  newCount: number;
  lastSerialNo: number | null;
  /** Motivo del fallo tal cual (`null` si conectó). */
  error: string | null;
}

/**
 * Historial de sincronización de un reloj: sus últimos intentos (el más
 * reciente primero) y el resumen ("¿falla seguido o fue un parpadeo?").
 */
export interface TimeClockSyncHistory {
  clockSerial: string;
  events: TimeClockSyncEvent[];
  summary: {
    attempts: number;
    okCount: number;
    failCount: number;
    /** Fallos consecutivos desde el más reciente (0 = el último conectó). */
    failuresInARow: number;
    lastOkAt: string | null;
    lastFailAt: string | null;
    lastError: string | null;
  };
}

