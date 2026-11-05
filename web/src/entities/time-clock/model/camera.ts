/** Cámara de la terminal. Solo lectura. */

export interface TimeClockVideoInput {
  id: string;
  name: string | null;
  enabled: boolean;
}

export interface TimeClockStream {
  id: string;
  name: string | null;
  enabled: boolean;
  transport: string | null;
  width: number | null;
  height: number | null;
}

export interface TimeClockCamera {
  inputs: TimeClockVideoInput[];
  streams: TimeClockStream[];
  /** `http`: se puede reproducir en el navegador. `none`: el stream es RTSP y necesita servidor de medios. */
  playback: { mode: "http"; url: string } | { mode: "none"; reason: "rtsp"; rtspPath: string | null };
}
