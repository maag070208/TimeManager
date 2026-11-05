#!/usr/bin/env python3
"""Cuenta "HTML a mano" donde el UI system ya tiene componente.

El dueño exige que las pantallas usen SOLO el sistema (ITFlex, ITText, ITCard,
ITChip, ITBento*…). Este medidor cuenta las etiquetas crudas y los estilos en
línea para poder bajar el número pantalla por pantalla.

Uso:
    python3 -I web/scripts/audit-raw-html.py            # resumen por módulo
    python3 -I web/scripts/audit-raw-html.py --files    # peores archivos
"""
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ["src/pages", "src/features", "src/widgets", "src/shared/ui"]
# Pantallas que no aplican: PDFs, landing pública, generadores de documentos.
# Pantallas que no aplican: landing pública, generadores de PDF/HTML para
# imprimir (su salida ES documento, no pantalla), correo y cocina (oculta).
SKIP = (
    "src/pages/landing/",
    "src/widgets/tickets/ticket-pdf/",
    "src/widgets/purchase-order-pdf/",
    "src/widgets/custody-letter/",
    "src/widgets/reports/",
    "src/widgets/time-clock-dashboard/",
    "src/features/kitchen/",
    "src/shared/ui/pdf",
)

PATTERNS = {
    "div": re.compile(r'<div\b'),
    "p": re.compile(r'<p\b'),
    "span": re.compile(r'<span\b'),
    "style": re.compile(r'style=\{\{'),
}

# Clasificación fina: qué componente del sistema reemplaza cada etiqueta.
CLASSES = {
    "layout": re.compile(r'<div\s+className="[^"]*(?:flex|grid|gap-|space-|items-|justify-|grid-cols)'),
    "text": re.compile(r'<(?:p|span|b|small|strong|em|h[1-6]|label)\b'),
    "table": re.compile(r'<(?:table|thead|tbody|tr|td|th)\b'),
    "control": re.compile(r'<(?:button|input|select|textarea)\b'),
    "style": re.compile(r'style=\{\{'),
}

# Estilos en línea que son *apariencia* (tienen que ir por tokens o componentes);
# los que calculan tamaños/colores de datos se aceptan.
STYLE_LOOK = re.compile(r'style=\{\{[^}]*(?:color|background|border|padding|margin|font|radius|shadow)')


def classify(text: str) -> collections.Counter:
    counts = collections.Counter({k: len(rx.findall(text)) for k, rx in CLASSES.items()})
    counts["styleLook"] = len(STYLE_LOOK.findall(text))
    return counts


def report(rows, totals, classes) -> None:
    """Escribe `HTML_AUDIT.md`: foto del HTML a mano, por área y por archivo."""
    areas = collections.Counter()
    area_total = collections.Counter()
    for rel, counts in rows:
        area = "/".join(rel.split("/")[1:2]) or "?"
        areas[area] += 1
        area_total[area] += sum(counts.values())

    lines = [
        "# Auditoría de HTML a mano (solo UI system)",
        "",
        "Generado por `python3 -I web/scripts/audit-raw-html.py --report`.",
        "Mide etiquetas crudas donde el kit ya tiene componente, **sin** contar la landing",
        "pública, los generadores de PDF/HTML para imprimir ni cocina (oculta).",
        "",
        f"**Total: {sum(totals.values())} etiquetas crudas en {len(rows)} archivos**",
        f"(div {totals['div']} · p {totals['p']} · span {totals['span']} · style {totals['style']}).",
        "",
        "## Por categoría",
        "",
        "| Categoría | Cuántas | Reemplazo correcto |",
        "|---|---:|---|",
        f"| Layout (`<div className=\"flex/grid…\">`) | {classes['layout']} | `ITFlex`, `ITStack`, `ITGrid` |",
        f"| Texto (`<p>`, `<span>`, `<b>`, `<small>`, `<h1..6>`) | {classes['text']} | `ITText` (con `as`, `muted`) |",
        f"| Tablas (`<table>`, `<tr>`, `<td>`…) | {classes['table']} | `ITDataTable` |",
        f"| Controles (`<button>`, `<input>`, `<select>`) | {classes['control']} | `ITButton`, `ITInput`, `ITSelect` |",
        f"| Estilos de apariencia (`style={{ color/bg/padding… }}`) | {classes['styleLook']} | tokens del kit o componente |",
        "",
        "## Por capa",
        "",
        "| Capa | Archivos | Etiquetas |",
        "|---|---:|---:|",
    ]
    for area in sorted(area_total, key=lambda a: -area_total[a]):
        lines.append(f"| `{area}` | {areas[area]} | {area_total[area]} |")

    lines += ["", "## Archivos con más HTML a mano", "", "| Archivo | div | p | span | style | total |", "|---|---:|---:|---:|---:|---:|"]
    for rel, counts in rows[:60]:
        lines.append(f"| `{rel}` | {counts['div']} | {counts['p']} | {counts['span']} | {counts['style']} | {sum(counts.values())} |")

    lines += [
        "",
        "## Cómo se corrige (regla del dueño)",
        "",
        "1. Texto → `ITText` (con `as` = p/span/b, `muted`, y `className` solo para tipografía o tokens).",
        "2. Layout → `ITFlex` (`align`, `justify`, `gap`), `ITStack` (vertical), `ITGrid` (columnas).",
        "3. Tarjeta → `ITCard`, `ITBentoTile`, `PanelCard`. Píldora → `ITChip`/`ITBentoPill`.",
        "4. Tabla → `ITDataTable` con la canon (`defaultItemsPerPage={25}`, `rowHeight={50}`, `virtualized`).",
        "5. Acción de fila → `RowAction` (solo ícono con fondo).",
        "6. `style={{}}` solo para valores que vienen de datos (anchos, colores de serie).",
        "",
        "Avance: volver a correr el script; el número tiene que bajar archivo por archivo.",
        "",
    ]
    out = os.path.join(ROOT, "HTML_AUDIT.md")
    open(out, "w", encoding="utf-8").write("\n".join(lines))
    print(f"reporte escrito en {out}")


def main() -> int:
    files = len(sys.argv) > 1 and "--files" in sys.argv
    by_file: dict[str, collections.Counter] = {}
    for d in DIRS:
        for base, _, names in os.walk(os.path.join(ROOT, d)):
            for name in names:
                if not name.endswith(".tsx"):
                    continue
                path = os.path.join(base, name)
                rel = os.path.relpath(path, ROOT)
                if rel.startswith(SKIP):
                    continue
                text = open(path, encoding="utf-8").read()
                counts = collections.Counter({k: len(rx.findall(text)) for k, rx in PATTERNS.items()})
                if sum(counts.values()):
                    by_file[rel] = counts

    totals = collections.Counter()
    classes = collections.Counter()
    for rel, counts in by_file.items():
        totals.update(counts)
        classes.update(classify(open(os.path.join(ROOT, rel), encoding="utf-8").read()))

    print(f"{'archivo':70} {'div':>5} {'p':>4} {'span':>5} {'style':>6} {'total':>6}")
    rows = sorted(by_file.items(), key=lambda kv: -sum(kv[1].values()))
    for rel, counts in (rows if files else rows[:15]):
        print(f"{rel:70} {counts['div']:5} {counts['p']:4} {counts['span']:5} {counts['style']:6} {sum(counts.values()):6}")
    print(f"\nTOTAL archivos={len(by_file)} div={totals['div']} p={totals['p']} span={totals['span']} style={totals['style']} suma={sum(totals.values())}")

    if "--report" in sys.argv:
        report(rows, totals, classes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
