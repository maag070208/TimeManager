import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { showToast } from "@app/toast/toast.slice";
import i18n, { dyn } from "@shared/i18n";

/** Confirma en pantalla una acción del portal: `key` es una llave de `nom:done`. */
export const usePortalToast = () => {
  const dispatch = useDispatch();
  return useCallback(
    (key: string) => {
      dispatch(showToast({ message: dyn(i18n.t)(`nom:done.${key}`), type: "success" }));
    },
    [dispatch]
  );
};
