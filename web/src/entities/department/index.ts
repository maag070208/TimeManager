// API pública del slice "department". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export { departmentsApi } from "./api/departmentApi";
export { useDepartmentOptions } from "./model/useDepartmentOptions";
