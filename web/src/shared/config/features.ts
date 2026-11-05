/**
 * Módulos apagados de la interfaz. El código sigue completo: apagar una bandera
 * solo quita la entrada del menú, su resumen por rol, los tableros del inicio y
 * su grupo en la consola de roles. Las rutas quedan montadas (nadie llega por
 * menú); si algún día se quiere bloquear también el enlace directo, el cambio va
 * aquí y en `App.tsx`.
 */
export const FEATURES = {
  /**
   * Cocina: el cliente todavía no dio luz verde. Se oculta a la espera de la
   * autorización; el API y las pantallas quedan intactos.
   */
  kitchen: false,
} as const;
