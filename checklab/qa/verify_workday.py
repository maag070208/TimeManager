#!/usr/bin/env python3
import json
import os
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAST = ROOT / "api" / "qa" / "out" / "cast.json"
OUTPUT = ROOT / "checklab" / "qa-evidence" / "android" / "workday-api.json"
API_URL = os.environ.get("QA_API_URL", "http://127.0.0.1:4031/api/v1").rstrip("/")
EXPECTED = ["ENTRY", "LUNCH_START", "LUNCH_END", "EXIT"]


def request(path, payload=None, token=None):
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API_URL}/{path}", data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)


def main():
    cast = json.loads(CAST.read_text())
    staff = cast["employees"][0]
    login = request("auth/login", {
        "username": staff["username"],
        "password": staff["password"],
        "tenant": cast["tenant"]["slug"],
    })
    punches = request("nom/me/punches?limit=200", token=login["token"])
    remote = sorted(
        (p for p in punches if p["source"] == "REMOTE"),
        key=lambda p: p["occurredAt"],
    )
    counts = Counter(p["type"] for p in remote)
    assert len(remote) == 4, f"Se esperaban 4 marcajes remotos; hay {len(remote)}"
    assert [p["type"] for p in remote] == EXPECTED, [p["type"] for p in remote]
    assert all(counts[t] == 1 for t in EXPECTED), dict(counts)
    result = {
        "employee": staff["label"],
        "tenant": cast["tenant"]["slug"],
        "passed": True,
        "types": [p["type"] for p in remote],
        "punches": remote,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"PASS: {len(remote)} marcajes remotos, orden y unicidad correctos: {', '.join(EXPECTED)}")


if __name__ == "__main__":
    main()
