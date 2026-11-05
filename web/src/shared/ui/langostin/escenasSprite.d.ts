// Tipos de los escenarios de Langostin (escenasSprite.js, sin dependencias).
// Los fondos se dibujan en un canvas de 64x40; la mascota (32x32) se pinta
// encima, en x=16 y=8.
export type LangostinScene =
  | "hotel"
  | "isla"
  | "navidad"
  | "playa"
  | "alberca"
  | "cuarto"
  | "sistemas"
  | "noche";

export const SCENES: LangostinScene[];

export interface EscenaBuild {
  /** Dibuja la escena; sin `build` se pinta solo el fondo. */
  build(anim: string, frame: number): (string | null)[][];
  /** Animación de la mascota dentro de la escena. */
  anim: string;
}

export function buildScene(
  name: string,
  frame: number
): { back: (string | null)[][]; front: (string | null)[][] };
export function drawScene(
  ctx: CanvasRenderingContext2D,
  name: string,
  frame: number,
  mascot?: EscenaBuild | null
): void;
export function mountScene(
  canvas: HTMLCanvasElement,
  name: string,
  anim: string,
  build?: (anim: string, frame: number) => (string | null)[][]
): number;
