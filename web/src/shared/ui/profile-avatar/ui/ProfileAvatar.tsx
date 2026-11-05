import { Blobatar } from "@blobatar/react";
import { useState } from "react";
import { ITText } from "@axzydev/axzy_ui_system";

const SIZE_MAP = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
} as const;

/** Resolución del Blobatar (px); cubre el tamaño más grande (xl / h-28). */
const BLOBATAR_SIZE = 128;

export interface ProfileAvatarProps {
  photoUrl?: string | null;
  /** Nombre de la persona: semilla del Blobatar de fallback y `alt` por defecto. */
  name: string;
  alt?: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

/**
 * Avatar circular con fallback garantizado a un Blobatar determinista.
 *
 * Bypassea al `ITAvatar` del kit porque su rama de fallback usa un ternario
 * mutuamente excluyente (`src ? <img onError=hide> : <ITText as="span">fallback</ITText>`):
 * cuando el `<img>` falla, el fallback no se renderiza y el contenedor queda
 * en blanco. Aquí el Blobatar (generado a partir de `name`) siempre se
 * renderiza como capa de fondo y la foto como overlay; en error de carga la
 * foto se desmonta y el Blobatar permanece visible.
 */
export default function ProfileAvatar({
  photoUrl,
  name,
  alt,
  size = "xl",
  className,
}: ProfileAvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImg = !!photoUrl && !errored;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-slate-100 flex-shrink-0 ${SIZE_MAP[size]} ${className ?? ""}`}
      role="img"
      aria-label={alt ?? name}
    >
      <Blobatar
        name={name}
        size={BLOBATAR_SIZE}
        background="square"
        alt=""
        className="absolute inset-0 h-full w-full object-cover select-none"
      />
      {showImg && (
        <img
          src={photoUrl!}
          alt={alt ?? name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}