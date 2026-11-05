import type { PersonalProfile } from "@entities/hr";
import { LOGO_PUERTO_NUEVO_BASE64 } from "@shared/assets/logoPuertoNuevo";
import { PDF_COLORS } from "@shared/pdf/theme";
import { CREDENTIAL_H_PX, CREDENTIAL_W_PX, LAYOUT } from "./cardSpec";
import { i18n } from "@shared/i18n";

export interface CredentialRenderInput {
  profile: PersonalProfile;
  qrDataUrl: string | null;
  photoDataUrl: string | null;
  initials: string;
  year: number;
}

/** Pila tipográfica genérica: el PNG no incrusta fuentes, así que no se elige una marca. */
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Texto por defecto cuando un campo viene vacío. */
const EMPTY = "—";

/** Carga una imagen (los dataURL no contaminan el canvas) o devuelve `null`. */
const loadImage = async (src: string): Promise<HTMLImageElement | null> => {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
};

/** Tinta el `letterSpacing` del contexto cuando el navegador lo soporta. */
const setLetterSpacing = (ctx: CanvasRenderingContext2D, value: string): void => {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = value;
};

/** Traza un rectángulo con esquinas redondeadas en el path actual. */
const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
};

/** Dibuja la imagen cubriendo el rectángulo (cover-crop centrado). */
const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void => {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/** Dibuja la imagen completa dentro del rectángulo (contain, centrada). */
const drawImageContain = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void => {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/** Recorta el texto a `maxWidth` agregando elipsis si no cabe. */
const truncate = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let crop = text;
  while (crop.length > 1 && ctx.measureText(`${crop}…`).width > maxWidth) {
    crop = crop.slice(0, -1);
  }
  return `${crop}…`;
};

/** Reparte el texto en líneas que quepan, hasta `maxLines`, con elipsis si sobra. */
const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [EMPTY];

  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i++];
    while (i < words.length) {
      const candidate = `${line} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        i++;
      } else {
        break;
      }
    }
    lines.push(line);
  }

  const surplus = i < words.length;
  if (surplus && lines.length) {
    lines[lines.length - 1] = truncate(ctx, `${lines[lines.length - 1]}…`, maxWidth);
  }
  return lines;
};

/** Dibuja la credencial completa sobre el contexto ya dimensionado. */
export const drawCredential = async (
  ctx: CanvasRenderingContext2D,
  input: CredentialRenderInput
): Promise<void> => {
  const { profile, qrDataUrl, photoDataUrl, initials, year } = input;
  const name = profile.name?.trim() || EMPTY;
  const number = profile.employeeNumber?.trim() || EMPTY;
  const jobTitle = profile.jobTitle?.trim() || EMPTY;
  const department = profile.department?.name?.trim() || EMPTY;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Fondo blanco opaco: la credencial se imprime, no debe tener transparencia.
  ctx.fillStyle = PDF_COLORS.white;
  ctx.fillRect(0, 0, CREDENTIAL_W_PX, CREDENTIAL_H_PX);

  // Banda superior + acento.
  ctx.fillStyle = PDF_COLORS.band;
  ctx.fillRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h);
  ctx.fillStyle = PDF_COLORS.bandAccent;
  ctx.fillRect(LAYOUT.accent.x, LAYOUT.accent.y, LAYOUT.accent.w, LAYOUT.accent.h);

  // Logo sobre badge blanco.
  ctx.beginPath();
  ctx.arc(LAYOUT.logoBadge.cx, LAYOUT.logoBadge.cy, LAYOUT.logoBadge.r, 0, Math.PI * 2);
  ctx.fillStyle = PDF_COLORS.white;
  ctx.fill();
  const logo = await loadImage(LOGO_PUERTO_NUEVO_BASE64);
  if (logo) {
    const { x, y, w, h } = LAYOUT.logo;
    drawImageContain(ctx, logo, x, y, w, h);
  }

  // Encabezados.
  ctx.fillStyle = PDF_COLORS.white;
  ctx.font = `bold ${LAYOUT.title.size}px ${FONT}`;
  ctx.fillText(i18n.t("employees:credential.title"), LAYOUT.title.x, LAYOUT.title.baseline);
  ctx.fillStyle = "#bfe0f0";
  ctx.font = `${LAYOUT.subtitle.size}px ${FONT}`;
  ctx.fillText(
    i18n.t("employees:credential.subtitle"),
    LAYOUT.subtitle.x,
    LAYOUT.subtitle.baseline
  );

  // Foto o iniciales.
  const photo = photoDataUrl ? await loadImage(photoDataUrl) : null;
  const { x: fx, y: fy, w: fw, h: fh, radius, border } = LAYOUT.photo;
  if (photo) {
    ctx.save();
    roundRectPath(ctx, fx, fy, fw, fh, radius);
    ctx.clip();
    drawImageCover(ctx, photo, fx, fy, fw, fh);
    ctx.restore();

    roundRectPath(ctx, fx, fy, fw, fh, radius);
    ctx.lineWidth = border;
    ctx.strokeStyle = PDF_COLORS.band;
    ctx.stroke();
  } else {
    roundRectPath(ctx, fx, fy, fw, fh, radius);
    ctx.fillStyle = PDF_COLORS.band;
    ctx.fill();

    ctx.fillStyle = PDF_COLORS.white;
    ctx.font = `bold 84px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials || EMPTY, fx + fw / 2, fy + fh / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Bloque de datos.
  const rows = [
    { label: i18n.t("employees:credential.employeeNumber"), value: number, size: 22 },
    { label: i18n.t("employees:credential.fullName"), value: name, size: 24 },
    { label: i18n.t("employees:credential.jobTitle"), value: jobTitle, size: 22 },
    { label: i18n.t("employees:credential.department"), value: department, size: 22 },
  ];
  const { x: dx, w: dw, startY, step } = LAYOUT.data;
  rows.forEach((row, index) => {
    const y = startY + index * step;

    // Separador primero, para que el texto quede encima si llega a envolver.
    ctx.strokeStyle = PDF_COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx, y + LAYOUT.row.separatorOffset);
    ctx.lineTo(dx + dw, y + LAYOUT.row.separatorOffset);
    ctx.stroke();

    ctx.fillStyle = PDF_COLORS.muted;
    ctx.font = `bold 13px ${FONT}`;
    setLetterSpacing(ctx, "1px");
    ctx.fillText(row.label.toUpperCase(), dx, y + LAYOUT.row.labelOffset);
    setLetterSpacing(ctx, "0px");

    ctx.fillStyle = PDF_COLORS.ink;
    ctx.font = `${row.size}px ${FONT}`;
    const lines = wrapLines(ctx, row.value, dw, 2);
    const lineHeight = row.size + 4;
    lines.forEach((line, i) => {
      ctx.fillText(line, dx, y + LAYOUT.row.valueOffset + i * lineHeight);
    });
  });

  // QR con quiet zone blanca y etiqueta debajo.
  const qr = qrDataUrl ? await loadImage(qrDataUrl) : null;
  const { x: qx, y: qy, size: qs, quiet } = LAYOUT.qr;
  ctx.fillStyle = PDF_COLORS.white;
  ctx.fillRect(qx - quiet, qy - quiet, qs + quiet * 2, qs + quiet * 2);
  if (qr) {
    // Sin suavizado: el QR viene a mayor resolución y al reducirlo los módulos
    // deben quedar con bordes duros, no difuminados.
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, qx, qy, qs, qs);
    ctx.imageSmoothingEnabled = prevSmoothing;
  }

  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = `${LAYOUT.qrLabel.size}px ${FONT}`;
  ctx.textAlign = "center";
  const labels = wrapLines(
    ctx,
    i18n.t("employees:credential.scanToVerify"),
    qs + 40,
    LAYOUT.qrLabel.maxLines
  );
  labels.forEach((line, i) => {
    ctx.fillText(line, LAYOUT.qrLabel.cx, LAYOUT.qrLabel.baseline + i * LAYOUT.qrLabel.lineHeight);
  });
  ctx.textAlign = "left";

  // Pie.
  ctx.strokeStyle = PDF_COLORS.bandAccent;
  ctx.lineWidth = LAYOUT.footerLine.h;
  ctx.beginPath();
  ctx.moveTo(LAYOUT.footerLine.x, LAYOUT.footerLine.y);
  ctx.lineTo(LAYOUT.footerLine.x + LAYOUT.footerLine.w, LAYOUT.footerLine.y);
  ctx.stroke();

  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = `${LAYOUT.footerSize}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(number, LAYOUT.footerLeftX, LAYOUT.footerBaseline);
  ctx.textAlign = "right";
  ctx.fillText(i18n.t("employees:credential.footer", { year }), LAYOUT.footerRightX, LAYOUT.footerBaseline);
  ctx.textAlign = "left";
};
