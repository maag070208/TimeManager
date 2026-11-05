/**
 * Especificación física de la credencial de empleado.
 *
 * Formato INE horizontal: 8.6 cm de ancho × 5.4 cm de alto, renderizado a
 * 300 DPI (calidad de imprenta). Todo el layout del canvas sale de aquí: es la
 * única fuente de verdad de medidas y coordenadas.
 */

export const CREDENTIAL_DPI = 300;

/** Píxeles por centímetro a la resolución de la credencial (300 / 2.54). */
export const PX_PER_CM = CREDENTIAL_DPI / 2.54;

/** 8.6 cm × 300 DPI = 1016 px. */
export const CREDENTIAL_W_PX = Math.round(8.6 * PX_PER_CM);

/** 5.4 cm × 300 DPI = 638 px. */
export const CREDENTIAL_H_PX = Math.round(5.4 * PX_PER_CM);

/** Relación de aspecto ancho/alto, para reservar el espacio del `<img>`. */
export const CREDENTIAL_ASPECT = CREDENTIAL_W_PX / CREDENTIAL_H_PX;

/**
 * Coordenadas del layout, en píxeles del canvas (1016 × 638).
 *
 * `x`/`y` son la esquina superior izquierda; `baseline`/`cx` marcan el punto de
 * anclaje del texto (canvas 2D).
 */
export const LAYOUT = {
  /** Banda superior azul y su línea de acento inferior. */
  band: { x: 0, y: 0, w: CREDENTIAL_W_PX, h: 120 },
  accent: { x: 0, y: 120, w: CREDENTIAL_W_PX, h: 6 },

  /** Badge circular blanco con el logo del hotel. */
  logoBadge: { cx: 68, cy: 60, r: 38 },
  logo: { x: 40, y: 32, w: 56, h: 56 },

  /** Encabezados dentro de la banda. */
  title: { x: 126, baseline: 58, size: 30 },
  subtitle: { x: 126, baseline: 90, size: 15 },

  /** Foto del empleado (cover-crop, esquinas redondeadas). */
  photo: { x: 44, y: 176, w: 200, h: 248, radius: 16, border: 3 },

  /** Bloque de datos: 4 filas con paso uniforme. */
  data: { x: 272, w: 470, startY: 176, step: 86 },
  row: { labelOffset: 16, valueOffset: 52, separatorOffset: 70 },

  /** QR + su etiqueta. La quiet zone es el margen blanco alrededor del módulo. */
  qr: { x: 760, y: 176, size: 232, quiet: 16 },
  qrLabel: { cx: 876, baseline: 422, size: 13, lineHeight: 18, maxLines: 2 },

  /** Pie con número de empleado y marca del sistema. */
  footerLine: { x: 44, y: 566, w: 928, h: 1 },
  footerBaseline: 596,
  footerLeftX: 44,
  footerRightX: 972,
  footerSize: 13,
} as const;
