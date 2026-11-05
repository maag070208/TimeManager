"use strict";

/**
 * Proceso principal de TimeManagerAgent.
 *
 * - Ventana React (tema TimeManager) con el estado del agente.
 * - Servicio local (`agent-service.cjs`) que habla ISAPI con el reloj y HTTPS
 *   con el API; arranca al abrir la app y sobrevive a la ventana cerrada en la
 *   bandeja de macOS/Windows mientras el proceso siga vivo.
 * - Configuración y cola local en `app.getPath("userData")`; el token se
 *   cifra con `safeStorage` cuando el SO lo ofrece.
 */

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { ConfigStore } = require("./config-store.cjs");
const { Logger } = require("./logger.cjs");
const { AgentService } = require("./agent-service.cjs");

const VERSION = require("../package.json").version;
const AUTOSTART_NAME = "timemanager-agent.desktop";

let window = null;
let store = null;
let logger = null;
let service = null;

const userData = () => app.getPath("userData");

const send = (channel, payload) => {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
};

const registerAutoStart = (enabled) => {
  if (process.platform === "linux") {
    const dir = path.join(os.homedir(), ".config", "autostart");
    const file = path.join(dir, AUTOSTART_NAME);
    try {
      if (!enabled) {
        fs.rmSync(file, { force: true });
      } else {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          file,
          [
            "[Desktop Entry]",
            "Type=Application",
            "Name=TimeManagerAgent",
            `Exec="${process.execPath}"`,
            "X-GNOME-Autostart-enabled=true",
            "Terminal=false",
            "",
          ].join("\n"),
          "utf8"
        );
      }
    } catch (error) {
      logger.warn(`No se pudo configurar el arranque automático: ${error.message}`);
    }
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
};

const createWindow = () => {
  window = new BrowserWindow({
    icon: path.join(__dirname, "..", "resources", "icon.png"),
    width: 1080,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: "#F4F6FA",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // La ventana es solo la UI del agente: no navega ni abre ventanas externas.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexHtml)) {
    void dialog.showMessageBox({
      type: "error",
      title: "TimeManagerAgent",
      message: "Falta compilar la interfaz.",
      detail: "Ejecuta `pnpm build` (o `pnpm app`) en la carpeta agent/ antes de abrir la app.",
    });
    app.quit();
    return;
  }
  void window.loadFile(indexHtml);
  window.on("closed", () => {
    window = null;
  });
};

const bootstrap = () => {
  store = new ConfigStore(path.join(userData(), "config.json"), {
    safeStorage: require("electron").safeStorage,
  });
  logger = new Logger(path.join(userData(), "logs", "agent.log"));
  logger.info(`TimeManagerAgent v${VERSION} arrancando en ${process.platform}.`);

  service = new AgentService({
    config: store,
    logger,
    version: VERSION,
    onState: (state) => send("agent:state", state),
  });

  ipcMain.handle("agent:get-state", () => service.snapshot());
  ipcMain.handle("agent:get-version", () => VERSION);
  ipcMain.handle("agent:save-config", (_event, patch) => {
    const saved = service.saveConfig(patch || {});
    if (typeof (patch || {}).autoStart === "boolean") registerAutoStart(patch.autoStart);
    return saved;
  });
  ipcMain.handle("agent:set-token", async (_event, token) => service.setToken(token));
  ipcMain.handle("agent:register", () => service.register());
  ipcMain.handle("agent:sync-now", () => service.syncNow());
  ipcMain.handle("agent:test-clock", (_event, serialNumber) => service.testClock(serialNumber));
  ipcMain.handle("agent:rotate-token", () => service.rotateToken());
  ipcMain.handle("agent:open-logs-folder", () => {
    shell.showItemInFolder(path.join(userData(), "logs", "agent.log"));
  });
  ipcMain.handle("agent:export-logs", async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const result = await dialog.showSaveDialog({
      title: "Exportar logs del agente",
      defaultPath: path.join(app.getPath("documents"), `timemanager-agent-${stamp}.log`),
      filters: [{ name: "Log", extensions: ["log", "txt"] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    logger.exportTo(result.filePath);
    return { saved: true, path: result.filePath };
  });

  createWindow();
  registerAutoStart(store.read().autoStart);
  service.start();
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox("TimeManagerAgent", error instanceof Error ? error.message : String(error));
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && store) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    if (service) service.stop();
  });
}
