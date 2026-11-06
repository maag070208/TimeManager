/**
 * Branding del cliente vigente para documentos generados fuera del árbol de
 * React (PDFs, credencial en canvas) y para la marca del correo. Lo registra
 * `app/` al cambiar la sesión; `null` = sin cliente (marca CheckLab).
 */
export interface TenantBrand {
  name: string | null;
  /** Color de acento (`#RRGGBB`); `null` = paleta CheckLab. */
  color: string | null;
  /** Logo del cliente como data URL; `null` = logo CheckLab. */
  logoDataUrl: string | null;
}

let brand: TenantBrand = { name: null, color: null, logoDataUrl: null };

export const setTenantBrand = (next: Partial<TenantBrand> | null): void => {
  brand = {
    name: next?.name ?? null,
    color: next?.color ?? null,
    logoDataUrl: next?.logoDataUrl ?? null,
  };
};

/** Compatibilidad: solo el nombre. */
export const setTenantBrandName = (name: string | null): void => setTenantBrand({ ...brand, name });

export const getTenantBrand = (): TenantBrand => brand;
export const getTenantBrandName = (): string | null => brand.name;
export const getTenantBrandColor = (): string | null => brand.color;
export const getTenantBrandLogo = (): string | null => brand.logoDataUrl;
