import { useEffect, useRef, type CSSProperties } from "react";
import { draw, type LangostinAnim } from "./langostinSprite";

interface Props {
  anim?: LangostinAnim;
  /** Tamaño en px (cuadrado). */
  size?: number;
  /** Milisegundos entre cuadros. */
  speed?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
  /** false = dibuja un solo cuadro, sin animar. */
  animated?: boolean;
}

// Mascota 8-bit dibujada en canvas 32x32, sin imágenes.
export default function Langostin({
  anim = "idle",
  size = 128,
  speed = 140,
  className,
  style,
  label = "Langostin, la mascota de Puerto Nuevo",
  animated = true,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    draw(ctx, anim, 0);
    if (!animated) return;
    const id = window.setInterval(() => {
      frame += 1;
      draw(ctx, anim, frame);
    }, speed);
    return () => window.clearInterval(id);
  }, [anim, speed, animated]);

  return (
    <canvas
      ref={ref}
      width={32}
      height={32}
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated", ...style }}
      role="img"
      aria-label={label}
    />
  );
}
