/**
 * Nombre del cliente vigente para los documentos que se generan fuera del
 * árbol de React (PDFs, credencial en canvas). Lo registra `app/` al cambiar
 * la sesión; `null` = sin cliente (se muestra la marca TimeManager).
 */
let tenantName: string | null = null;

export const setTenantBrandName = (name: string | null) => {
  tenantName = name;
};

export const getTenantBrandName = (): string | null => tenantName;
