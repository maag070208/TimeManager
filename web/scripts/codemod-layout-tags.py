#!/usr/bin/env python3
"""Cambia `<div className="flex …">` por `ITFlex`/`ITStack` del UI system.

Sólo convierte los casos **mecánicos**: el `className` está compuesto únicamente
de utilidades de layout (flex, dirección, wrap, items, justify, gap, flex-1,
shrink-0, min-w-0) y el `div` no lleva otros atributos que `className` y `key`.
Todo lo demás (padding, bordes, fondos, responsive, handlers) se deja para
convertirlo a mano: ahí hay que decidir entre `ITStack`, `ITCard`, `ITFlex` con
clases o un componente del kit.

Uso:
    python3 -I web/scripts/codemod-layout-tags.py --dry
    python3 -I web/scripts/codemod-layout-tags.py --apply
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

CONVERTIBLE = re.compile(
    r"^(?:flex|flex-col|flex-row|flex-wrap|flex-nowrap|\s*"
    r"items-(?:start|end|center|baseline|stretch)|"
    r"justify-(?:start|end|center|between|around|evenly)|"
    r"gap-(?:\d+(?:\.\d+)?)|flex-1|shrink-0|min-w-0)$"
)
KIT_IMPORT = re.compile(r'import \{([^}]*)\} from "@axzydev/axzy_ui_system";')
DIV_OPEN = re.compile(r"<div(?P<attrs>\s[^<>]*?)?>")
DIV_CLOSE = re.compile(r"</div>")
CLASS_ATTR = re.compile(r'className="([^"]*)"')
KEY_ATTR = re.compile(r'key=(\{[^{}]*\}|"[^"]*")')


def tokens_to_props(class_name: str) -> dict:
    """Traduce las utilidades de Tailwind a props de ITFlex (sin clases sueltas)."""
    props: dict[str, str] = {}
    leftovers: list[str] = []
    col = False
    for token in class_name.split():
        if token in ("flex", "flex-row"):
            continue
        if token == "flex-col":
            col = True
        elif token == "flex-wrap":
            props["wrap"] = "wrap"
        elif token == "flex-nowrap":
            props["wrap"] = "nowrap"
        elif token.startswith("items-"):
            props["align"] = token.split("-", 1)[1]
        elif token.startswith("justify-"):
            props["justify"] = token.split("-", 1)[1]
        elif token.startswith("gap-"):
            props["gap"] = token.split("-", 1)[1]
        else:
            leftovers.append(token)
    if col:
        props["direction"] = "column"
    if leftovers:
        props["className"] = " ".join(leftovers)
    return props


def render(name: str, props: dict, extra: str) -> str:
    attrs = []
    # ITFlex usa align/justify/wrap/gap; ITStack, alignItems/justifyContent/flexWrap/spacing.
    stack = name == "ITStack"
    mapping = (
        (("align", "alignItems"), ("justify", "justifyContent"), ("wrap", "flexWrap"))
        if stack
        else (("align", "align"), ("justify", "justify"), ("wrap", "wrap"))
    )
    for source, target in mapping:
        if source in props:
            attrs.append(f'{target}="{props[source]}"')
    if "direction" in props and not stack:
        attrs.append(f'direction="{props["direction"]}"')
    if "gap" in props:
        gap = props["gap"]
        attrs.append(f"gap={{{gap}}}")
    if "className" in props:
        attrs.append(f'className="{props["className"]}"')
    attrs.append(extra.strip())
    body = " ".join(a for a in attrs if a)
    return f"<{name} {body}>" if body else f"<{name}>"


def rewrite(text: str) -> tuple[str, int]:
    out: list[str] = []
    stack: list[str | None] = []  # nombre del componente si se convirtió, si no None
    changed = 0
    pos = 0
    for match in re.finditer(DIV_OPEN.pattern + "|" + DIV_CLOSE.pattern, text):
        out.append(text[pos : match.start()])
        pos = match.end()
        raw = match.group(0)
        if raw == "</div>":
            converted = stack.pop() if stack else None
            out.append(f"</{converted}>" if converted else raw)
            if converted:
                changed += 1
            continue

        attrs = match.group(1) or ""
        klass = CLASS_ATTR.search(attrs)
        if not klass:
            out.append(raw)
            stack.append(None)
            continue
        tokens = klass.group(1).split()
        rest = attrs.replace(klass.group(0), "")
        key = KEY_ATTR.search(rest)
        only_key = not rest.strip() or (key and not rest.replace(key.group(0), "").strip())
        if not tokens or not all(CONVERTIBLE.match(t) for t in tokens) or not only_key:
            out.append(raw)
            stack.append(None)
            continue
        props = tokens_to_props(klass.group(1))
        name = "ITStack" if props.get("direction") == "column" else "ITFlex"
        if name == "ITStack":
            # ITStack usa `spacing`, no `gap`; la dirección ya es columna.
            props.pop("direction", None)
            if "gap" in props:
                props["spacing"] = props.pop("gap")
        extra = key.group(0) if key else ""
        if "spacing" in props:
            extra = f'{extra} spacing={{{props.pop("spacing")}}}'.strip()
        out.append(render(name, props, extra))
        stack.append(name)
    out.append(text[pos:])
    return "".join(out), changed


def ensure_imports(text: str) -> str:
    """Agrega `ITFlex`/`ITStack` al import del kit si se usaron y faltan."""
    needed = [name for name in ("ITFlex", "ITStack") if f"<{name}" in text]
    if not needed:
        return text
    existing = KIT_IMPORT.search(text)
    if existing:
        have = {part.strip() for part in existing.group(1).split(",")}
        missing = [name for name in needed if name not in have]
        if not missing:
            return text
        clean = existing.group(1).rstrip().rstrip(",")
        return text.replace(existing.group(0), f'import {{{clean}, {", ".join(missing)} }} from "@axzydev/axzy_ui_system";', 1)
    lines = text.split("\n")
    last = -1
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.startswith("} from "):
            last = i
    lines.insert(last + 1, f'import {{ {", ".join(needed)} }} from "@axzydev/axzy_ui_system";')
    return "\n".join(lines)


def main() -> int:
    apply = "--apply" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not paths:
        for d in DIRS:
            for base, _, names in os.walk(os.path.join(ROOT, d)):
                for name in names:
                    if name.endswith(".tsx"):
                        rel = os.path.relpath(os.path.join(base, name), ROOT)
                        if not rel.startswith(SKIP):
                            paths.append(rel)
    total = files = 0
    for rel in paths:
        path = os.path.join(ROOT, rel)
        text = open(path, encoding="utf-8").read()
        new, changed = rewrite(text)
        if not changed:
            continue
        new = ensure_imports(new)
        if apply:
            open(path, "w", encoding="utf-8").write(new)
        files += 1
        total += changed
        print(f"{rel:78} {changed:4}")
    print(f"\n{'APLICADO' if apply else 'ENSAYO'}: {total} divs en {files} archivos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
