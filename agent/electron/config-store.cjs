"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Configuración local del agente en `userData/config.json`.
 *
 * El token de dispositivo es el secreto más delicado del equipo: si Electron
 * ofrece `safeStorage` (Keychain en macOS, DPAPI en Windows, libsecret en
 * Linux) se guarda cifrado con `enc:v1:`; si no, se guarda en claro y la UI
 * avisa. Nunca se manda a la ventana (la UI solo lee `tokenSet`).
 */
const TOKEN_PREFIX = "enc:v1:";

const DEFAULTS = {
  apiUrl: "http://localhost:4001/api/v1",
  chunkSeconds: 20,
  jobsPollSeconds: 5,
  heartbeatSeconds: 30,
  autoStart: false,
  token: "",
  cursors: {},
};

class ConfigStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.safeStorage = options.safeStorage || null;
    this.state = null;
  }

  read() {
    if (this.state) return this.state;
    let stored = {};
    try {
      stored = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      stored = {};
    }
    this.state = { ...DEFAULTS, ...stored, cursors: { ...(stored.cursors || {}) } };
    return this.state;
  }

  write(patch) {
    const next = { ...this.read(), ...patch };
    this.state = next;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(temp, this.filePath);
    return next;
  }

  /** Valores que puede ver la UI (sin token, sin cursor interno). */
  publicConfig() {
    const state = this.read();
    return {
      apiUrl: state.apiUrl,
      chunkSeconds: state.chunkSeconds,
      jobsPollSeconds: state.jobsPollSeconds,
      heartbeatSeconds: state.heartbeatSeconds,
      autoStart: state.autoStart,
      tokenSet: Boolean(this.getToken()),
    };
  }

  getToken() {
    const raw = this.read().token || "";
    if (!raw) return "";
    if (!raw.startsWith(TOKEN_PREFIX)) return raw;
    if (!this.safeStorage || !this.safeStorage.isEncryptionAvailable()) return "";
    try {
      return this.safeStorage.decryptString(Buffer.from(raw.slice(TOKEN_PREFIX.length), "base64"));
    } catch {
      return "";
    }
  }

  setToken(token) {
    const clean = String(token || "").trim();
    let stored = "";
    if (clean) {
      stored =
        this.safeStorage && this.safeStorage.isEncryptionAvailable()
          ? `${TOKEN_PREFIX}${this.safeStorage.encryptString(clean).toString("base64")}`
          : clean;
    }
    this.write({ token: stored });
    return clean;
  }

  getCursors() {
    return { ...this.read().cursors };
  }

  setCursor(serialNumber, value) {
    const cursors = { ...this.read().cursors };
    cursors[serialNumber] = Math.max(Number(cursors[serialNumber]) || 0, Number(value) || 0);
    this.write({ cursors });
    return cursors[serialNumber];
  }

  /** Cola local de checadas pendientes (local-first: sobrevive reinicios). */
  readQueue() {
    const queueFile = path.join(path.dirname(this.filePath), "queue.json");
    try {
      const parsed = JSON.parse(fs.readFileSync(queueFile, "utf8"));
      return Array.isArray(parsed.punches) ? parsed.punches : [];
    } catch {
      return [];
    }
  }

  writeQueue(punches) {
    const queueFile = path.join(path.dirname(this.filePath), "queue.json");
    fs.mkdirSync(path.dirname(queueFile), { recursive: true });
    const temp = `${queueFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ punches: punches || [] }, null, 2), "utf8");
    fs.renameSync(temp, queueFile);
    return punches || [];
  }
}

module.exports = { ConfigStore, DEFAULTS, TOKEN_PREFIX };
