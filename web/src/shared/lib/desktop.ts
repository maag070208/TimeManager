/**
 * Puente con la app de escritorio (Electron, `web/electron/preload.cts`).
 * En el navegador no existe: `desktop` es `undefined`.
 */
export interface DesktopNotification {
  /** Id de la notificación guardada, para marcarla leída al hacer clic. */
  id?: string;
  title: string;
  body?: string;
  /** Ruta interna que se abre al hacer clic (p. ej. `/tickets/:id`). */
  route?: string;
}

export interface DesktopBridge {
  /** Muestra una notificación nativa del sistema operativo. */
  notify: (notification: DesktopNotification) => void;
  /** Clic en una notificación nativa; devuelve la función para dejar de escuchar. */
  onNotificationClick: (callback: (click: Pick<DesktopNotification, "id" | "route">) => void) => () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined = typeof window === "undefined" ? undefined : window.desktop;
