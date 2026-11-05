#!/usr/bin/env python3
"""Cambia etiquetas de texto crudas por `ITText` del UI system.

El dueño exige que las pantallas usen SOLO el sistema. `<p>`, `<span>`, `<b>`,
`<strong>`, `<small>`, `<em>`, `<h1..h6>` y `<label>` pasan a `ITText` con su
mismo `className`, y `ITText` renderiza exactamente la misma etiqueta
(`ITText as="span"` produce un `<span>`): el aspecto no cambia, sólo la fuente.

Uso:
    python3 -I web/scripts/codemod-text-tags.py --dry     # ver qué haría
    python3 -I web/scripts/codemod-text-tags.py --apply   # aplicar en toda la app
    python3 -I web/scripts/codemod-text-tags.py --apply src/features/x/ui/Y.tsx
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ["src/pages", "src/features", "src/widgets", "src/shared/ui"]
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

TAG = r"p|span|b|strong|small|em|label|h[1-6]"
COMBINED = re.compile(
    r"<(?P<otag>" + TAG + r")(?P<attrs>(?:\s[^<>]*?)?)(?P<sc>/?)>" r"|</(?P<ctag>" + TAG + r")>"
)
KIT_IMPORT = re.compile(r'import \{([^}]*)\} from "@axzydev/axzy_ui_system";')


def rewrite(text: str) -> tuple[str, int]:
    """Reescribe pares apertura/cierre con una pila; un par que no casa se deja igual."""
    out: list[str] = []
    stack: list[str] = []
    changed = 0
    pos = 0

    for match in COMBINED.finditer(text):
        out.append(text[pos : match.start()])
        pos = match.end()
        raw = match.group(0)

        if match.group("ctag"):
            tag = match.group("ctag")
            if stack and stack[-1] == tag:
                stack.pop()
                out.append("</ITText>")
                changed += 1
            else:
                out.append(raw)
            continue

        tag = match.group("otag")
        attrs = match.group("attrs") or ""
        if match.group("sc"):
            out.append(raw)
            continue
        out.append(f"<ITText{attrs}>" if tag == "p" else f'<ITText as="{tag}"{attrs}>')
        stack.append(tag)

    out.append(text[pos:])
    return "".join(out), changed


def ensure_import(text: str) -> str:
    existing = KIT_IMPORT.search(text)
    if existing and re.search(r"\bITText\b", existing.group(1)):
        return text
    if existing:
        return text.replace(
            existing.group(0),
            f'import {{{existing.group(1).rstrip().rstrip(",")}, ITText }} from "@axzydev/axzy_ui_system";',
            1,
        )
    lines = text.split("\n")
    last = -1
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.startswith("} from "):
            last = i
    lines.insert(last + 1, 'import { ITText } from "@axzydev/axzy_ui_system";')
    return "\n".join(lines)


def process(rel: str, apply: bool) -> int:
    path = os.path.join(ROOT, rel)
    text = open(path, encoding="utf-8").read()
    new, changed = rewrite(text)
    # Si el archivo ya usa `<ITText` pero le falta el import (corrida anterior),
    # también se arregla; `changed` sigue siendo 0 para el conteo.
    if changed or "<ITText" in new:
        new = ensure_import(new)
    if apply and new != text:
        open(path, "w", encoding="utf-8").write(new)
    return changed


def main() -> int:
    apply = "--apply" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        paths = args
    else:
        paths = []
        for d in DIRS:
            for base, _, names in os.walk(os.path.join(ROOT, d)):
                for name in names:
                    if not name.endswith(".tsx"):
                        continue
                    rel = os.path.relpath(os.path.join(base, name), ROOT)
                    if not rel.startswith(SKIP):
                        paths.append(rel)

    total = files = 0
    for rel in paths:
        changed = process(rel, apply)
        if changed:
            files += 1
            total += changed
            print(f"{rel:78} {changed:4}")
    print(f"\n{'APLICADO' if apply else 'ENSAYO'}: {total} etiquetas en {files} archivos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
