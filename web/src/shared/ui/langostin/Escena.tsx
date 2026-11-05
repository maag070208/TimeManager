import { useEffect, useRef, type CSSProperties } from "react";
import { drawScene } from "./escenasSprite";
import { build } from "./langostinSprite";
import type { LangostinScene } from "./escenasSprite";

interface Props {
  /** Escenario: hotel | isla | navidad | playa | alberca | cuarto | sistemas | noche */
  scene?: LangostinScene;
  /** Animación de la mascota dentro del escenario. */
  anim?: string;
  /** false = solo el fondo, sin la mascota. */
  mascot?: boolean;
  /** Ancho en px (la altura es 40/64 del ancho). */
  size?: number;
  /** Milisegundos entre cuadros. */
  speed?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

/**
 * Escenario 8-bit de Langostin (64x40 px): el fondo y la mascota se dibujan
 * en el mismo canvas, sin imágenes ni dependencias.
 */
export default function Escena({
  scene = "hotel",
  anim = "idle",
  mascot = true,
  size = 384,
  speed = 140,
  className,
  style,
  label,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const m = mascot ? { build, anim } : null;
    let frame = 0;
    drawScene(ctx, scene, 0, m);
    const id = window.setInterval(() => {
      frame += 1;
      drawScene(ctx, scene, frame, m);
    }, speed);
    return () => window.clearInterval(id);
  }, [scene, anim, mascot, speed]);

  return (
    <canvas
      ref={ref}
      width={64}
      height={40}
      className={className}
      style={{ width: size, height: (size * 40) / 64, imageRendering: "pixelated", ...style }}
      role="img"
      aria-label={label ?? `Escena ${scene}`}
    />
  );
}
