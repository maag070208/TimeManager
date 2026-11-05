import os, re, sys
from collections import defaultdict
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
MODULES = {
 "inventory": ["pages/inventory", "features/inventory"],
 "tickets (incl kanban)": ["pages/tickets", "features/ticket"],
 "hr/employees/users": ["pages/employees", "pages/users", "features/hr", "features/user"],
 "access/time-clock/schedules/overtime": ["pages/access", "pages/schedules", "pages/overtime", "features/access", "features/schedule"],
 "kitchen": ["pages/kitchen", "features/kitchen"],
 "roles/catalog/depts/settings": ["pages/roles", "pages/catalog", "pages/departments", "pages/subareas", "features/roles", "features/catalog", "features/department", "features/subarea", "features/sys-config"],
 "other": ["pages/landing", "pages/langostin", "pages/notifications", "pages/reports", "features/langostin", "features/notification", "features/report"],
}
EXCL = ("features/home", "features/auth", "pages/home", "pages/auth")
HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')
BGW = re.compile(r'bg-white')
OVR = re.compile(r'!rounded-|!border|shadow-')
UPT = re.compile(r'uppercase\s+tracking-|tracking-\S*\s+uppercase\b')
BRD = re.compile(r'border border-slate-200')
KPI = re.compile(r'<(KpiTile|PanelCard|StatCard)\b')

def module_of(rel):
    for m, prefs in MODULES.items():
        for p in prefs:
            if rel == p or rel.startswith(p + "/"):
                return m
    return None

rows = defaultdict(lambda: dict(files=0, a=0, b=0, c=0, d=0, e=0, f=0))
per_file = []
for base, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith((".ts", ".tsx", ".jsx", ".js")):
            continue
        rel = os.path.relpath(os.path.join(base, fn), ROOT)
        if rel.startswith(EXCL) or not rel.startswith(("pages/", "features/")):
            continue
        mod = module_of(rel)
        if mod is None:
            print("UNMAPPED", rel, file=sys.stderr); continue
        cnt = dict(a=0, b=0, c=0, d=0, e=0, f=0)
        with open(os.path.join(base, fn), encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if re.search(r'className|style', line):
                    cnt["a"] += len(HEX.findall(line))
                cnt["b"] += len(BGW.findall(line))
                if "ITCard" in line:
                    cnt["c"] += len(OVR.findall(line))
                elif "!rounded-" in line or "!border" in line:
                    cnt["c"] += len(re.findall(r'!rounded-|!border', line))
                if "<thead" not in line and "<th " not in line:
                    cnt["d"] += len(UPT.findall(line))
                if "ITCard" in line:
                    cnt["e"] += len(BRD.findall(line))
                cnt["f"] += len(KPI.findall(line))
        r = rows[mod]; r["files"] += 1
        for k in cnt: r[k] += cnt[k]
        score = cnt["a"] + cnt["b"] + cnt["c"] + cnt["d"] + cnt["e"]
        if score or cnt["f"]:
            per_file.append((mod, rel, score, cnt))

print("| module | files | a hex | b bg-white | c ITCard ovr | d uppercase | e border-hack | KpiTile/PanelCard/StatCard |")
tot = dict(files=0, a=0, b=0, c=0, d=0, e=0, f=0)
for m in MODULES:
    r = rows[m]
    print(f"| {m} | {r['files']} | {r['a']} | {r['b']} | {r['c']} | {r['d']} | {r['e']} | {r['f']} |")
    for k in tot: tot[k] += r[k]
print(f"| TOTAL | {tot['files']} | {tot['a']} | {tot['b']} | {tot['c']} | {tot['d']} | {tot['e']} | {tot['f']} |")
print()
ALL = "--all" in sys.argv
for m in MODULES:
    items = sorted([p for p in per_file if p[0] == m], key=lambda x: -x[2])
    if not ALL:
        items = items[:3]
    print(f"## {m}")
    for _, rel, score, cnt in items:
        dom = max(["a","b","c","d","e"], key=lambda k: cnt[k])
        print(f"- {rel} score={score} a={cnt['a']} b={cnt['b']} c={cnt['c']} d={cnt['d']} e={cnt['e']} f={cnt['f']} dom={dom}")
