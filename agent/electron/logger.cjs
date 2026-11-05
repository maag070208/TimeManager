"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Log del agente: buffer circular en memoria para la UI + archivo en
 * `userData/logs/agent.log` (una línea por evento). El archivo se rota a
 * `agent.1.log` al pasar de `maxBytes`; exportable desde la UI.
 */
const LEVELS = ["info", "warn", "error"];

class Logger {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.maxLines = options.maxLines || 400;
    this.maxBytes = options.maxBytes || 2 * 1024 * 1024;
    this.lines = [];
    this.listeners = new Set();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list() {
    return [...this.lines];
  }

  log(level, message) {
    const safeLevel = LEVELS.includes(level) ? level : "info";
    const line = { at: new Date().toISOString(), level: safeLevel, message: String(message) };
    this.lines.push(line);
    if (this.lines.length > this.maxLines) this.lines.shift();
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.filePath, `${line.at} [${safeLevel}] ${line.message}\n`, "utf8");
    } catch {
      // Un fallo de disco no debe tumbar el ciclo de sincronización.
    }
    for (const listener of this.listeners) listener(line);
    return line;
  }

  info(message) {
    return this.log("info", message);
  }

  warn(message) {
    return this.log("warn", message);
  }

  error(message) {
    return this.log("error", message);
  }

  rotateIfNeeded() {
    try {
      const { size } = fs.statSync(this.filePath);
      if (size < this.maxBytes) return;
      fs.renameSync(this.filePath, `${this.filePath}.1`);
    } catch {
      // El archivo puede no existir todavía.
    }
  }

  exportTo(targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const body = this.lines.map((line) => `${line.at} [${line.level}] ${line.message}`).join("\n");
    fs.writeFileSync(targetPath, `${body}\n`, "utf8");
    return targetPath;
  }
}

module.exports = { Logger };
