import type { ReactNode } from "react";
import shots from "../shots.json";

export type ShotName = keyof typeof shots;

/** Ancho de la variante chica que genera `capture-landing.mjs`. */
const SMALL_WIDTH = 960;

/**
 * Captura real del producto con datos demo (`scripts/capture-landing.mjs`).
 * `crop` recorta a una proporción fija anclada arriba a la izquierda.
 */
export const Shot = ({
  name,
  alt,
  eager = false,
  crop,
  className = "",
  sizes = "(min-width: 1024px) 720px, 100vw",
}: {
  name: ShotName;
  alt: string;
  eager?: boolean;
  crop?: string;
  className?: string;
  sizes?: string;
}) => {
  const { width, height } = shots[name];
  const src = `/landing/shots/${name}.webp`;
  const srcSet = width > SMALL_WIDTH ? `/landing/shots/${name}-${SMALL_WIDTH}.webp ${SMALL_WIDTH}w, ${src} ${width}w` : undefined;
  return (
    <figure className={`cl-shot ${className}`} style={crop ? { aspectRatio: crop } : undefined}>
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className={crop ? "h-full w-full object-cover object-left-top" : "block h-auto w-full"}
      />
    </figure>
  );
};

/** Marco de ventana con la ruta de la pantalla y el rótulo de datos demo. */
export const ShotWindow = ({ path, children, className = "" }: { path: string; children: ReactNode; className?: string }) => (
  <div className={`cl-window ${className}`}>
    <div className="cl-window-bar">
      <span className="cl-window-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="cl-window-url">CheckLab · {path}</span>
      <span className="cl-demo-tag">Datos de demostración</span>
    </div>
    {children}
  </div>
);
