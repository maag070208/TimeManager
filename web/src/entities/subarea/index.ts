// API pública del slice "subarea". El tipo Subarea vive en @entities/department
// (por la dependencia natural hacia Department) — aquí solo se reexporta.
export type { Subarea } from "@entities/department";
export { subareaApi } from "./api/subareaApi";
