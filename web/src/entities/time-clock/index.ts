// API pública del slice "checador" (relojes Hikvision). Nada fuera de esta
// carpeta debe importar directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export * from "./model/status";
export * from "./model/roster";
export * from "./model/inspect";
export * from "./model/people";
export * from "./model/clockSync";
export * from "./model/camera";
export * from "./model/summary";
export * from "./model/person";
export { timeClockApi } from "./api/timeClockApi";
