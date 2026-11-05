// API pública del slice "report". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export { reportsApi } from "./api/reportApi";