// API pública del slice "dashboard". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export { dashboardApi } from "./api/dashboardApi";
