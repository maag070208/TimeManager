import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Flecha de regreso de las pantallas: vuelve a la entrada anterior del
 * historial cuando la pantalla se abrió desde la app; si se abrió directo
 * (enlace, notificación, recarga) no hay a dónde volver y va a `fallback`.
 *
 * Nunca "regresar" con un push al padre: si el padre regresa con el historial,
 * los dos se mandan uno al otro y la flecha ya no saca de ahí.
 */
export const useGoBack = () => {
  const navigate = useNavigate();
  // La primera entrada que ve el router (carga o recarga) trae la llave "default".
  const hasHistory = useLocation().key !== "default";

  return useCallback(
    (fallback = "/") => {
      if (hasHistory) navigate(-1);
      else navigate(fallback, { replace: true });
    },
    [hasHistory, navigate],
  );
};
