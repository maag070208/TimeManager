import { useEffect, useRef, useState } from "react";
import { ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaExternalLinkAlt, FaMapMarkerAlt } from "react-icons/fa";
import { i18n } from "@shared/i18n";

const API_KEY = (import.meta.env as Record<string, string | undefined>)
  .VITE_GOOGLE_MAPS_API_KEY;

let googleMapsPromise: Promise<void> | null = null;

/** Carga el SDK de Google Maps una sola vez (sin dependencias externas). */
function loadGoogleMaps(key: string): Promise<void> {
  const g = (window as unknown as { google?: { maps?: unknown } }).google;
  if (g?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google-maps-load-failed"));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export interface LocationMapProps {
  latitude: number;
  longitude: number;
  /** Altura del mapa en px. @default 220 */
  height?: number;
  /** Texto bajo el mapa (p. ej. "Ubicación del escaneo"). */
  caption?: string;
  /** Texto del enlace externo. @default "Ver en el mapa" */
  linkLabel?: string;
}

/**
 * Mapa de solo lectura con un marcador en las coordenadas dadas.
 *
 * Usa Google Maps (JS API) con `VITE_GOOGLE_MAPS_API_KEY`; si falta el key o
 * falla la carga, cae al embed público de OpenStreetMap (sin API key).
 */
export default function LocationMap({
  latitude,
  longitude,
  height = 220,
  caption,
  linkLabel = i18n.t("common:map.view"),
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(!API_KEY);

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;

    loadGoogleMaps(API_KEY)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const maps = (window as unknown as { google: any }).google.maps;
        const center = { lat: latitude, lng: longitude };
        // Limpia instancias previas (StrictMode monta el efecto dos veces).
        mapRef.current.innerHTML = "";
        const map = new maps.Map(mapRef.current, {
          center,
          zoom: 18,
          mapTypeId: "hybrid",
          mapTypeControl: true,
          mapTypeControlOptions: { position: maps.ControlPosition.TOP_RIGHT },
          gestureHandling: "greedy",
          scrollwheel: true,
          streetViewControl: false,
          fullscreenControl: false,
        });
        new maps.Marker({ position: center, map });
      })
      .catch(() => {
        if (!cancelled) setUseFallback(true);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const delta = 0.0035;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <ITFlex direction="column" gap={2}>
      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        style={{ height }}
      >
        {useFallback ? (
          <iframe
            title={caption ?? i18n.t("common:map.title")}
            src={osmSrc}
            loading="lazy"
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
          />
        ) : (
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        )}
      </div>
      <ITFlex align="center" justify="between" gap={2} wrap="wrap">
        <ITFlex align="center" gap={1} className="min-w-0">
          <FaMapMarkerAlt size={11} className="shrink-0 text-rose-500" />
          <ITText className="truncate text-[11px] text-slate-500">{caption}</ITText>
        </ITFlex>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#0D5777] hover:underline"
        >
          <FaExternalLinkAlt size={10} />
          {linkLabel}
        </a>
      </ITFlex>
    </ITFlex>
  );
}
