import { useEffect } from "react";

const TITLE = "CheckLab · Control de asistencia, horas extra y pre-nómina";
const DESCRIPTION =
  "Checada con reloj o desde la web con ubicación, horas extra con la LFT, pre-nómina con cierre y registro de jornada con prueba ante la autoridad.";

/**
 * Metadatos propios de la landing (la app es una SPA con un solo index.html).
 * Se restauran al salir para no contaminar el resto de las pantallas.
 */
export const useLandingSeo = () => {
  useEffect(() => {
    const origin = window.location.origin;
    const image = `${origin}/landing/og-image.jpg`;
    const tags: Array<[attr: "name" | "property", key: string, value: string]> = [
      ["name", "description", DESCRIPTION],
      ["property", "og:type", "website"],
      ["property", "og:title", TITLE],
      ["property", "og:description", DESCRIPTION],
      ["property", "og:url", `${origin}/#/landing`],
      ["property", "og:image", image],
      ["property", "og:image:width", "1200"],
      ["property", "og:image:height", "630"],
      ["property", "og:locale", "es_MX"],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", TITLE],
      ["name", "twitter:description", DESCRIPTION],
      ["name", "twitter:image", image],
    ];

    const restore: Array<() => void> = [];
    const previousTitle = document.title;
    document.title = TITLE;
    restore.push(() => {
      document.title = previousTitle;
    });

    for (const [attr, key, value] of tags) {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (el) {
        const previous = el.content;
        const node = el;
        restore.push(() => {
          node.content = previous;
        });
      } else {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        const node = el;
        restore.push(() => node.remove());
        document.head.appendChild(el);
      }
      el.content = value;
    }

    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${origin}/`;
    document.head.appendChild(canonical);
    restore.push(() => canonical.remove());

    return () => restore.reverse().forEach((undo) => undo());
  }, []);
};
