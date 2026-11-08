/**
 * Genera `design/LucideIcons.kt` con los trazos de los iconos Lucide que usa la
 * web (react-icons/lu, licencia ISC), para dibujarlos nativos en la app.
 *
 *   node checklab/scripts/gen-lucide.mjs   (desde la raíz del repo; usa web/node_modules)
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../web/package.json", import.meta.url));
const lu = require("react-icons/lu");

const ICONS = {
  User: "LuUser", Eye: "LuEye", EyeOff: "LuEyeOff", LogIn: "LuLogIn", ArrowRight: "LuArrowRight",
  ArrowLeft: "LuArrowLeft", Fingerprint: "LuFingerprint", CalendarClock: "LuCalendarClock", Timer: "LuTimer",
  FileChart: "LuFileChartColumn", ShieldCheck: "LuShieldCheck", Building: "LuBuilding2", LogOut: "LuLogOut",
  RefreshCw: "LuRefreshCw", KeyRound: "LuKeyRound",
  Menu: "LuMenu", X: "LuX", House: "LuHouse", CalendarCheck: "LuCalendarCheck", Users: "LuUsers",
  FolderOpen: "LuFolderOpen", Clock: "LuClock", CalendarDays: "LuCalendarDays", ArrowLeftRight: "LuArrowLeftRight",
  Wallet: "LuWallet", Plane: "LuPlane", Handshake: "LuHandshake", Laptop: "LuLaptop", ScanFace: "LuScanFace",
  Settings: "LuSettings", ScrollText: "LuScrollText", Bell: "LuBell", Layers: "LuLayers", Briefcase: "LuBriefcase",
  ChevronRight: "LuChevronRight", Gauge: "LuGauge",
  MapPin: "LuMapPin", Utensils: "LuUtensils", Coffee: "LuCoffee", CloudOff: "LuCloudOff", Check: "LuCheck",
  ExternalLink: "LuExternalLink", MessageSquareWarning: "LuMessageSquareWarning",
};

const tree = (name) => {
  const src = lu[name].toString();
  return JSON.parse(src.slice(src.indexOf("GenIcon(") + 8, src.lastIndexOf(")(props)")));
};

const n = (v) => Number(v);
const toPath = ({ tag, attr }) => {
  switch (tag) {
    case "path": return attr.d;
    case "circle": { const [cx, cy, r] = [n(attr.cx), n(attr.cy), n(attr.r)];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; }
    case "line": return `M${attr.x1} ${attr.y1}L${attr.x2} ${attr.y2}`;
    case "polyline": case "polygon": {
      const pts = attr.points.trim().split(/[\s,]+/).map(Number);
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? d + "Z" : d; }
    case "rect": { const [x, y, w, h] = [n(attr.x ?? 0), n(attr.y ?? 0), n(attr.width), n(attr.height)];
      const r = Math.min(n(attr.rx ?? attr.ry ?? 0), w / 2, h / 2);
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`; }
    default: throw new Error(`etiqueta no soportada: ${tag}`);
  }
};

const entries = Object.entries(ICONS).map(([key, name]) => {
  const paths = tree(name).child.map(toPath).map((d) => `"${d}"`).join(", ");
  return `    val ${key} = LucideIcon(listOf(${paths}))`;
});

const out = `package com.axzydev.checklab.design

// Generado por checklab/scripts/gen-lucide.mjs desde react-icons/lu (Lucide, ISC). No editar a mano.
object Lucide {
${entries.join("\n")}
}
`;
fs.writeFileSync(new URL("../shared/src/commonMain/kotlin/com/axzydev/checklab/design/LucideIcons.kt", import.meta.url), out);
console.log(`${entries.length} iconos`);
