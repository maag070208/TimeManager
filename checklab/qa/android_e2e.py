#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

PACKAGE = "com.axzydev.checklab"
ACTIVITY = "com.axzydev.checklab/.MainActivity"
ADMIN_SECTIONS = [
    "Personal", "Expedientes", "Actas administrativas", "Departamentos",
    "Asistencias", "Vacaciones y permisos", "Convenios y acuerdos",
    "Teletrabajo (NOM-037)", "Horarios", "Asignar horarios", "Tiempo extra",
    "Pre Nómina", "Puestos de nómina", "Relojes", "Configuración del sistema",
    "Roles y permisos", "Auditoría",
]


class AndroidBot:
    def __init__(self, serial, cast_path, out_dir, api_url):
        self.serial = serial
        self.cast = json.loads(Path(cast_path).read_text())
        self.out = Path(out_dir)
        self.out.mkdir(parents=True, exist_ok=True)
        self.api_url = api_url.rstrip("/")
        self.adb = os.environ.get("AAO_ADB", "/Users/axzy/Library/Android/sdk/platform-tools/adb")
        self.results = []
        self.started = datetime.now().isoformat(timespec="seconds")

    def run(self, *args, timeout=30, binary=False):
        cmd = [self.adb, "-s", self.serial, *args]
        result = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
        if result.returncode != 0:
            raise RuntimeError(f"adb {args[0]}: {result.stderr.decode(errors='replace').strip()}")
        return result.stdout if binary else result.stdout.decode(errors="replace").strip()

    def check(self, name, ok, detail=""):
        self.results.append({"name": name, "passed": bool(ok), "detail": detail})
        print(f"{'✓' if ok else '✗'} {name}" + (f" — {detail}" if detail and not ok else ""), flush=True)
        self.write_report()
        return ok

    def tree(self):
        remote = "/sdcard/checklab-qa-ui.xml"
        local = self.out / "ui-current.xml"
        self.run("shell", "uiautomator", "dump", remote)
        self.run("pull", remote, str(local))
        root = ET.parse(local).getroot()
        nodes = list(root.iter("node"))
        parents = {child: parent for parent in nodes for child in parent}
        return nodes, parents

    @staticmethod
    def label(node):
        return node.get("text", "") or node.get("content-desc", "")

    @staticmethod
    def center(node):
        nums = [int(n) for n in re.findall(r"\d+", node.get("bounds", ""))]
        if len(nums) != 4:
            raise RuntimeError("Elemento sin coordenadas")
        return (nums[0] + nums[2]) // 2, (nums[1] + nums[3]) // 2

    def texts(self):
        nodes, _ = self.tree()
        return [self.label(n) for n in nodes if self.label(n)]

    def find(self, text, contains=False):
        nodes, parents = self.tree()
        matches = [n for n in nodes if (text in self.label(n) if contains else self.label(n) == text)]
        if not matches:
            return None
        node = matches[0]
        while node is not None and node.get("clickable") != "true":
            node = parents.get(node)
        return node or matches[0]

    def wait_for(self, text, contains=False, timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.find(text, contains) is not None:
                return True
            time.sleep(1)
        return False

    def tap_node(self, node):
        x, y = self.center(node)
        self.run("shell", "input", "tap", str(x), str(y))
        time.sleep(1)

    def tap(self, text, contains=False, scroll=False):
        for attempt in range(6 if scroll else 1):
            node = self.find(text, contains)
            if node is not None:
                self.tap_node(node)
                return True
            if scroll:
                self.run("shell", "input", "swipe", "650", "1780", "650", "850", "350")
                time.sleep(1)
        return False

    def fill(self, index, value):
        nodes, _ = self.tree()
        edits = [n for n in nodes if "EditText" in n.get("class", "")]
        if index >= len(edits):
            raise RuntimeError(f"No existe el campo editable {index}")
        node = edits[index]
        previous = node.get("text", "")
        self.tap_node(node)
        self.run("shell", "input", "keyevent", "KEYCODE_MOVE_END")
        for _ in range(len(previous) + 4):
            self.run("shell", "input", "keyevent", "KEYCODE_DEL")
        self.run("shell", "input", "text", value.replace(" ", "%s"))
        time.sleep(1)

    def hide_keyboard(self):
        self.run("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(1)

    def screenshot(self, name):
        path = self.out / f"{name}.png"
        path.write_bytes(self.run("exec-out", "screencap", "-p", binary=True))
        return path

    def launch(self):
        self.run("shell", "am", "start", "-n", ACTIVITY)
        time.sleep(3)

    def restart(self):
        self.run("shell", "am", "force-stop", PACKAGE)
        self.launch()

    def open_menu(self):
        if self.find("Cerrar el menú de navegación") is not None:
            return True
        if self.tap("Abrir menú"):
            return True
        return self.tap("Menú")

    def ensure_logged_out(self):
        if self.find("Código de tu empresa") is not None:
            return
        self.open_menu()
        if not self.tap("Cerrar sesión", scroll=True):
            raise RuntimeError("No se encontró Cerrar sesión")
        self.wait_for("Código de tu empresa")

    def login(self, member, invalid_password=False):
        self.ensure_logged_out()
        self.fill(0, self.cast["tenant"]["slug"])
        self.hide_keyboard()
        self.tap("Continuar")
        if not self.wait_for("Usuario o número de empleado"):
            raise RuntimeError("No abrió el formulario de credenciales")
        self.fill(0, member["username"])
        self.fill(1, "clave-incorrecta" if invalid_password else member["password"])
        self.hide_keyboard()
        node = self.find("Entrar a ", contains=True)
        if node is None:
            raise RuntimeError("No se encontró el botón de entrar")
        self.tap_node(node)

    def navigate(self, label):
        if not self.open_menu():
            return self.check(f"Abrir menú para {label}", False)
        if not self.tap(label, scroll=True):
            return self.check(f"Navegar a {label}", False, "No aparece en el drawer")
        ok = self.wait_for(label, timeout=12)
        denied = self.find("No tienes acceso a esta sección.") is not None
        return self.check(f"Admin abre {label}", ok and not denied)

    def api_login(self, member):
        body = json.dumps({"username": member["username"], "password": member["password"], "tenantSlug": self.cast["tenant"]["slug"]}).encode()
        request = urllib.request.Request(f"{self.api_url}/auth/login", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.load(response)
        return payload.get("accessToken") or payload.get("token") or payload.get("access_token")

    def api_punches(self, member):
        token = self.api_login(member)
        request = urllib.request.Request(f"{self.api_url}/nom/me/punches?limit=50", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)

    def auth_and_navigation(self):
        self.launch()
        self.ensure_logged_out()
        self.fill(0, "qa-no-existe")
        self.hide_keyboard()
        self.tap("Continuar")
        self.check("Empresa inexistente muestra error", self.wait_for("No encontramos la empresa", contains=True))
        self.login(self.cast["admin"], invalid_password=True)
        self.check("Credenciales inválidas muestran error", self.wait_for("Credenciales inválidas"))
        self.login(self.cast["admin"])
        self.check("Admin inicia sesión", self.wait_for("Hola,", contains=True, timeout=20))
        self.screenshot("bot-01-admin-home")
        for section in ADMIN_SECTIONS:
            self.navigate(section)
            if section in {"Personal", "Horarios", "Pre Nómina", "Relojes", "Configuración del sistema"}:
                self.screenshot(f"bot-admin-{ADMIN_SECTIONS.index(section) + 1:02d}")
        self.navigate("Inicio")
        self.restart()
        self.check("Sesión admin sobrevive reinicio de proceso", self.wait_for("Hola,", contains=True, timeout=20))
        self.ensure_logged_out()
        self.check("Logout admin regresa a empresa", self.find("Código de tu empresa") is not None)
        self.login(self.cast["employees"][0])
        employee_name = self.cast["employees"][0]["label"].split()[0]
        self.check("Personal inicia sesión", self.wait_for(employee_name, contains=True, timeout=20))
        self.open_menu()
        self.check("Personal no ve Personal RH", self.find("Personal") is None)
        self.check("Personal no ve Roles y permisos", self.find("Roles y permisos") is None)
        self.screenshot("bot-02-staff-menu")

    def staff_tabs(self):
        if self.find("Código de tu empresa") is not None:
            self.login(self.cast["employees"][0])
            self.wait_for("Hola,", contains=True, timeout=20)
        self.tap("Mi jornada")
        self.check("Mi jornada muestra tabs", self.wait_for("Mi checada") and self.find("Teletrabajo") is not None)
        for tab in ["Teletrabajo", "Registro y horas extra", "Vacaciones y permisos", "Mi checada"]:
            ok = self.tap(tab)
            self.check(f"Personal abre tab {tab}", ok and self.wait_for(tab))
        self.screenshot("bot-03-staff-workday")

    def set_airplane(self, enabled):
        self.run("shell", "settings", "put", "global", "airplane_mode_on", "1" if enabled else "0")
        self.run("shell", "am", "broadcast", "-a", "android.intent.action.AIRPLANE_MODE", "--ez", "state", "true" if enabled else "false")
        time.sleep(3)

    def offline_punch(self):
        previous = self.run("shell", "settings", "get", "global", "airplane_mode_on")
        try:
            self.set_airplane(True)
            self.navigate("Inicio")
            if self.find("Registrar entrada", contains=True) is not None:
                self.tap("Registrar entrada", contains=True)
                self.check("Entrada offline queda en cola", self.wait_for("Se enviará sola", timeout=15))
            elif self.find("Salida a comer", contains=True) is not None:
                self.tap("Salida a comer", contains=True)
                self.check("Salida a comer offline queda en cola", self.wait_for("Se enviará sola", timeout=15))
            else:
                self.check("Existe un siguiente paso para probar offline", False, "Jornada sin acción disponible")
            self.screenshot("bot-04-offline-queued")
            self.restart()
            self.check("Cola offline sobrevive reinicio", self.wait_for("Se enviará sola", timeout=20))
        finally:
            self.set_airplane(previous == "1")
        self.restart()
        self.check("Cola se reconcilia al recuperar red", self.wait_for("Registrada", timeout=30))

    def write_report(self):
        passed = sum(1 for r in self.results if r["passed"])
        failed = len(self.results) - passed
        payload = {"surface": "Android físico", "serial": self.serial, "started": self.started, "passed": passed, "failed": failed, "results": self.results}
        (self.out / "report.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        lines = ["# Bot Android físico — CheckLab", "", f"Inicio: {self.started}", f"Dispositivo: `{self.serial}`", "", f"Resultado: **{passed}/{len(self.results)} pasos correctos; {failed} fallos**.", "", "| Paso | Resultado | Detalle |", "|---|---|---|"]
        lines += [f"| {r['name']} | {'PASÓ' if r['passed'] else 'FALLÓ'} | {r['detail']} |" for r in self.results]
        (self.out / "report.md").write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--cast", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--api-url", default="http://127.0.0.1:4031/api/v1")
    parser.add_argument("--scenario", choices=["auth", "tabs", "offline"], required=True)
    args = parser.parse_args()
    bot = AndroidBot(args.serial, args.cast, args.out, args.api_url)
    try:
        if args.scenario == "auth":
            bot.auth_and_navigation()
        elif args.scenario == "tabs":
            bot.staff_tabs()
        else:
            bot.offline_punch()
    except Exception as error:
        bot.check(f"Error del arnés: {args.scenario}", False, str(error))
        bot.screenshot(f"bot-error-{args.scenario}")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
