// API pública del slice "audit-log". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export { auditApi } from "./api/auditLogApi";