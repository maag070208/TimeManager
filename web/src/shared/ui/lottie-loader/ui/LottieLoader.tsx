import { Lottie } from "lottie-react";
import animationData from "@shared/assets/puerto-nuevo-logo.json";

export type LottieLoaderSize = "sm" | "md" | "lg";

export interface LottieLoaderProps {
  size?: LottieLoaderSize;
  className?: string;
  /** Etiqueta accesible del estado de carga. */
  label?: string;
}

const SIZE_PX: Record<LottieLoaderSize, number> = { sm: 48, md: 96, lg: 160 };

/**
 * Loader de marca: la animación del logotipo (Lottie) en lugar del spinner
 * genérico. Se usa en los estados de carga de las pantallas.
 */
export default function LottieLoader({
  size = "lg",
  className,
  label = "Cargando",
}: LottieLoaderProps) {
  const px = SIZE_PX[size];
  return (
    <div role="img" aria-label={label} className={className}>
      <Lottie src={animationData} loop autoplay style={{ width: px, height: px }} />
    </div>
  );
}
