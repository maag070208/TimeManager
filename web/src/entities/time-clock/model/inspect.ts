/** Lo que tiene un reloj, leído del propio equipo (solo lectura). */

export interface TimeClockInspectOverview {
  clock: { serialNumber: string; name: string | null; url: string };
  device: {
    serialNumber: string;
    model: string | null;
    deviceName: string | null;
    firmwareVersion: string | null;
    macAddress: string | null;
  };
  time: { localTime: string; timeMode: string | null; timeZone: string | null };
  counts: { userNumber: number; bindFaceUserNumber: number; bindFingerprintUserNumber: number; bindCardUserNumber: number };
}

export interface TimeClockInspectUser {
  employeeNumber: string;
  name: string;
}

export interface TimeClockInspectUsers {
  total: number;
  shown: number;
  people: TimeClockInspectUser[];
}

export interface TimeClockInspectCard {
  cardNo: string;
  employeeNumber: string;
  cardType: string | null;
}

export interface TimeClockInspectCards {
  total: number;
  shown: number;
  cards: TimeClockInspectCard[];
}

export interface TimeClockInspectEvent {
  serialNo: number;
  time: string;
  minor: number;
  employeeNumber: string | null;
  name: string | null;
}

export interface TimeClockInspectEvents {
  total: number;
  shown: number;
  events: TimeClockInspectEvent[];
}
