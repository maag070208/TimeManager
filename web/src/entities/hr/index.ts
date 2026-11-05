// API pública del slice "personal". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export { personalApi } from "./api/hrApi";
