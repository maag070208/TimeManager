"use strict";

/**
 * Servicio del agente: el ciclo local-first.
 *
 *   leer ISAPI → encolar en disco → subir chunks → ejecutar trabajos → heartbeat
 *
 * Todo el estado que importa (cursor por reloj y cola de checadas pendientes)
 * vive en `userData` para sobrevivir caídas y reinicios. Si el API no responde,
 * el agente sigue leyendo el reloj y encolando; al reconectar sube la cola sin
 * duplicar (idempotencia del API por `clockSerial + serialNo`).
 *
 * Sin dependencias de Electron a propósito: así el núcleo se puede probar y
 * reutilizar. La ventana y el disco se inyectan (`config`, `logger`).
 */

const core = require("./sync-core.cjs");
const { IsapiClient } = require("./isapi.cjs");

/** Error del API con status/código estable (401 = token inválido/revocado). */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code || null;
  }
}

const messageOf = (error) => {
  if (error instanceof ApiError) {
    return error.code ? `${error.status} ${error.code}: ${error.message}` : `${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
};

class AgentService {
  constructor(options) {
    this.config = options.config;
    this.logger = options.logger;
    this.onState = options.onState || (() => undefined);
    this.version = options.version || "0.1.0";
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.isapiFactory =
      options.isapiFactory ||
      ((clock) =>
        new IsapiClient(
          clock.url,
          clock.credentials ? clock.credentials.username : "",
          clock.credentials ? clock.credentials.password : ""
        ));
    this.now = options.now || Date.now;
    this.tickMs = options.tickMs || 1000;

    this.queue = this.config.readQueue();
    this.clocks = [];
    this.state = {
      running: false,
      busy: false,
      lastError: null,
      lastHeartbeatAt: null,
      lastSyncAt: null,
      pendingJobs: 0,
      agentId: null,
      tenantName: null,
      tokenValid: null,
      lastChunkAt: 0,
      lastPollAt: 0,
      lastBeatAt: 0,
    };
    this.loop = null;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────

  start() {
    if (this.state.running) return this.snapshot();
    this.state.running = true;
    this.loop = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    this.emit();
    void this.bootstrap();
    return this.snapshot();
  }

  stop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.state.running = false;
    this.emit();
  }

  /** Primer golpe: si ya hay token, registra y trae relojes. */
  async bootstrap() {
    if (!this.configured()) return;
    try {
      await this.register();
      this.logger.info("Agente registrado y configuración de relojes descargada.");
    } catch (error) {
      this.fail("No se pudo registrar el agente", error);
    }
  }

  configured() {
    const config = this.config.read();
    return Boolean(config.apiUrl && this.config.getToken());
  }

  /** Un paso del ciclo; se salta si el anterior sigue corriendo. */
  async tick() {
    if (this.state.busy || !this.configured()) return;
    this.state.busy = true;
    try {
      if (core.heartbeatDue(this.state.lastBeatAt, this.now(), this.config.read().heartbeatSeconds)) {
        await this.heartbeat();
      }
      if (core.pollDue(this.state.lastPollAt, this.now(), this.config.read().jobsPollSeconds)) {
        await this.pollJobs();
      }
      if (core.chunkDue(this.state.lastChunkAt, this.now(), this.config.read().chunkSeconds)) {
        await this.syncClocks();
      }
    } catch (error) {
      this.fail("Ciclo del agente", error);
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  fail(context, error) {
    const message = `${context}: ${messageOf(error)}`;
    this.state.lastError = message;
    this.logger.error(message);
  }

  // ── Configuración / credencial ────────────────────────────────────────

  publicConfig() {
    return this.config.publicConfig();
  }

  saveConfig(patch) {
    const next = { ...patch };
    if (next.chunkSeconds !== undefined) next.chunkSeconds = core.clampChunkSeconds(next.chunkSeconds);
    if (typeof next.apiUrl === "string") next.apiUrl = next.apiUrl.trim().replace(/\/+$/, "");
    this.config.write(next);
    this.state.lastError = null;
    this.logger.info("Configuración guardada.");
    this.emit();
    return this.snapshot();
  }

  async setToken(token) {
    this.config.setToken(token);
    this.state.tokenValid = null;
    this.emit();
    if (this.config.getToken()) {
      try {
        await this.register();
        this.logger.info("Token validado y agente registrado.");
      } catch (error) {
        this.fail("Token inválido", error);
        throw error;
      }
    }
    return this.snapshot();
  }

  async register() {
    const body = await this.api("POST", "/agent/register", {
      version: this.version,
      platform: process.platform,
    });
    this.state.tenantName = body && body.tenant ? body.tenant.name : null;
    this.state.tokenValid = true;
    await this.fetchConfig();
    this.state.lastError = null;
    this.emit();
    return this.snapshot();
  }

  async fetchConfig() {
    const config = await this.api("GET", "/agent/config");
    this.state.tenantName = config.tenant ? config.tenant.name : this.state.tenantName;
    this.state.agentId = config.agent ? config.agent.id : this.state.agentId;
    const cursors = this.config.getCursors();
    this.clocks = (config.clocks || []).map((clock) => ({
      serialNumber: clock.serialNumber,
      name: clock.name || null,
      url: clock.url,
      countsAttendance: Boolean(clock.countsAttendance),
      writeEnabled: Boolean(clock.writeEnabled),
      credentials: clock.credentials || null,
      serverCursor: Number(clock.lastSerialNo) || 0,
      cursor: Math.max(Number(cursors[clock.serialNumber]) || 0, Number(clock.lastSerialNo) || 0),
      ok: null,
      lastSyncAt: clock.syncedAt || null,
      error: null,
    }));
    for (const clock of this.clocks) {
      this.config.setCursor(clock.serialNumber, clock.cursor);
    }
    this.logger.info(
      `Configuración recibida: ${this.clocks.length} reloj(es) del cliente ${this.state.tenantName || "—"}.`
    );
    return config;
  }

  // ── Checadas: leer, encolar y subir ───────────────────────────────────

  async syncClocks() {
    if (this.clocks.length === 0) {
      await this.fetchConfig();
    }
    for (const clock of this.clocks) {
      await this.syncClock(clock);
    }
    this.state.lastChunkAt = this.now();
  }

  async syncClock(clock) {
    if (!clock.credentials) {
      clock.ok = false;
      clock.error = "El reloj no tiene credenciales configuradas";
      return { newCount: 0, cursor: clock.cursor };
    }
    const request = this.isapiFactory(clock);
    try {
      const cursor = Math.max(
        Number(clock.cursor) || 0,
        Number(this.config.getCursors()[clock.serialNumber]) || 0
      );
      const upTo = await request.lastSerialNo(cursor + 1);
      if (!upTo || upTo <= cursor) {
        clock.ok = true;
        clock.error = null;
        clock.lastSyncAt = new Date(this.now()).toISOString();
        clock.cursor = cursor;
        return { newCount: 0, cursor };
      }

      let newCount = 0;
      for (const window of core.planWindows(cursor, upTo)) {
        for (const minor of core.PUNCH_MINORS) {
          for await (const page of request.acsEvents(window.from, window.to, minor)) {
            const punches = page.events
              .map((event) => core.toPunch(event, clock.serialNumber))
              .filter(Boolean);
            const merged = core.mergePunches(this.queue, punches);
            this.queue = merged.queue;
            newCount += merged.added;
          }
        }
        this.config.writeQueue(this.queue);
        // Se sube antes de confirmar el cursor: si falla, la ventana queda en
        // cola local y el cursor no avanza (se reintenta sin duplicar).
        await this.uploadClock(clock, window.to);
        this.config.setCursor(clock.serialNumber, window.to);
        clock.cursor = window.to;
      }

      clock.ok = true;
      clock.error = null;
      clock.lastSyncAt = new Date(this.now()).toISOString();
      this.state.lastSyncAt = clock.lastSyncAt;
      if (newCount > 0) {
        this.logger.info(
          `${clock.name || clock.serialNumber}: ${newCount} checada(s) nueva(s), cursor ${clock.cursor}.`
        );
      }
      return { newCount, cursor: clock.cursor };
    } catch (error) {
      clock.ok = false;
      clock.error = messageOf(error);
      this.logger.warn(`${clock.name || clock.serialNumber}: ${clock.error}`);
      return { newCount: 0, cursor: clock.cursor };
    } finally {
      this.emit();
    }
  }

  /** Sube los pendientes de un reloj en lotes; la cola se recorta por confirmación. */
  async uploadClock(clock, lastSerialNo) {
    let uploaded = 0;
    for (;;) {
      const mine = this.queue.filter((punch) => punch.clockSerial === clock.serialNumber);
      if (mine.length === 0) break;
      const { batch } = core.takeBatch(mine, core.MAX_PUNCHES_PER_CHUNK);
      await this.api("POST", "/agent/punches", {
        clockSerial: clock.serialNumber,
        lastSerialNo,
        punches: batch.map((punch) => ({
          serialNo: punch.serialNo,
          employeeNumber: punch.employeeNumber,
          name: punch.name || "",
          minor: punch.minor,
          occurredAt: punch.occurredAt,
        })),
      });
      this.queue = core.removeUploaded(this.queue, batch);
      this.config.writeQueue(this.queue);
      uploaded += batch.length;
      if (batch.length < core.MAX_PUNCHES_PER_CHUNK) break;
    }
    if (uploaded > 0) {
      this.logger.info(`${clock.name || clock.serialNumber}: ${uploaded} checada(s) subida(s).`);
    }
    return uploaded;
  }

  // ── Trabajos ──────────────────────────────────────────────────────────

  async pollJobs() {
    this.state.lastPollAt = this.now();
    const response = await this.api("GET", `/agent/jobs?limit=5`);
    const jobs = (response && response.jobs) || [];
    for (const job of jobs) {
      await this.runJob(job);
    }
    return jobs.length;
  }

  async runJob(job) {
    this.logger.info(`Trabajo ${job.type} (${job.id}) recibido.`);
    try {
      const result = await this.executeJob(job);
      await this.api("POST", `/agent/jobs/${job.id}/result`, { ok: true, result });
      this.state.pendingJobs = Math.max(0, this.state.pendingJobs - 1);
      this.logger.info(`Trabajo ${job.type} completado.`);
    } catch (error) {
      const message = messageOf(error);
      try {
        await this.api("POST", `/agent/jobs/${job.id}/result`, { ok: false, error: message });
      } catch (reportError) {
        this.logger.error(`No se pudo reportar el fallo del trabajo ${job.id}: ${messageOf(reportError)}`);
      }
      this.logger.warn(`Trabajo ${job.type} falló: ${message}`);
    }
  }

  async executeJob(job) {
    const payload = job.payload || {};
    const serialNumber = payload.clockSerial || job.clockSerial;
    const clock = this.clockFor(serialNumber);
    const request = clock ? this.isapiFactory(clock) : null;

    switch (job.type) {
      case "SYNC": {
        if (!clock) throw new Error("El trabajo SYNC no indica un reloj configurado");
        const result = await this.syncClock(clock);
        return { clockSerial: clock.serialNumber, ...result };
      }
      case "PERSON_ADD": {
        if (!request) throw new Error("Reloj no configurado");
        requireFields(payload, ["employeeNumber", "name"]);
        await request.userAdd({
          employeeNumber: String(payload.employeeNumber),
          name: String(payload.name),
          gender: payload.gender ? String(payload.gender) : "unknown",
        });
        return { clockSerial: clock.serialNumber, employeeNumber: String(payload.employeeNumber) };
      }
      case "PERSON_REMOVE": {
        if (!request) throw new Error("Reloj no configurado");
        requireFields(payload, ["employeeNumber"]);
        await request.userDelete(String(payload.employeeNumber));
        return { clockSerial: clock.serialNumber, employeeNumber: String(payload.employeeNumber) };
      }
      case "CARD_ADD": {
        if (!request) throw new Error("Reloj no configurado");
        requireFields(payload, ["employeeNumber", "cardNo"]);
        await request.cardAdd(String(payload.employeeNumber), String(payload.cardNo));
        return { clockSerial: clock.serialNumber, cardNo: String(payload.cardNo) };
      }
      case "CARD_REMOVE": {
        if (!request) throw new Error("Reloj no configurado");
        requireFields(payload, ["cardNo"]);
        await request.cardDelete(String(payload.cardNo));
        return { clockSerial: clock.serialNumber, cardNo: String(payload.cardNo) };
      }
      case "FINGERPRINT_APPLY": {
        if (!request) throw new Error("Reloj no configurado");
        requireFields(payload, ["employeeNumber", "fingerPrintID", "fingerData"]);
        await request.fingerprintAdd({
          employeeNumber: String(payload.employeeNumber),
          fingerPrintID: Number(payload.fingerPrintID),
          fingerData: String(payload.fingerData),
        });
        let applied = false;
        for (let attempt = 0; attempt < 10 && !applied; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          applied = await request.fingerprintApplied();
        }
        if (!applied) throw new Error("El reloj no confirmó el alta de la huella");
        return { clockSerial: clock.serialNumber, employeeNumber: String(payload.employeeNumber) };
      }
      default:
        throw new Error(`Tipo de trabajo no soportado: ${job.type}`);
    }
  }

  async syncNow() {
    if (!this.configured()) throw new Error("Configura el API y el token primero");
    this.state.busy = true;
    try {
      if (this.clocks.length === 0) await this.fetchConfig();
      await this.syncClocks();
      await this.pollJobs();
      await this.heartbeat();
      this.state.lastError = null;
      this.logger.info("Sincronización manual terminada.");
    } catch (error) {
      this.fail("Sincronización manual", error);
      throw error;
    } finally {
      this.state.busy = false;
      this.emit();
    }
    return this.snapshot();
  }

  async testClock(serialNumber) {
    const clock = this.clockFor(serialNumber);
    if (!clock) return { ok: false, message: "Reloj no configurado en este agente" };
    if (!clock.credentials) return { ok: false, message: "El reloj no tiene credenciales configuradas" };
    try {
      const info = await this.isapiFactory(clock).deviceInfo();
      clock.ok = true;
      clock.error = null;
      this.emit();
      return { ok: true, message: `Conectó: ${info.model || "Hikvision"} (serie ${info.serialNumber})` };
    } catch (error) {
      clock.ok = false;
      clock.error = messageOf(error);
      this.emit();
      return { ok: false, message: clock.error };
    }
  }

  // ── Heartbeat y token ─────────────────────────────────────────────────

  async heartbeat() {
    this.state.lastBeatAt = this.now();
    const body = await this.api("POST", "/agent/heartbeat", {
      version: this.version,
      lastSyncAt: this.state.lastSyncAt || undefined,
      pendingPunches: this.queue.length,
      clocks: this.clocks.map((clock) => ({
        serialNumber: clock.serialNumber,
        ok: clock.ok === true,
        error: clock.error || undefined,
      })),
    });
    this.state.lastHeartbeatAt = new Date(this.now()).toISOString();
    if (body && Number.isFinite(body.pendingJobs)) this.state.pendingJobs = body.pendingJobs;
    return body;
  }

  async rotateToken() {
    const body = await this.api("POST", "/agent/token");
    this.config.setToken(body.token);
    this.state.tokenValid = true;
    this.logger.info("Token de dispositivo rotado; guarda el nuevo token y actualiza el panel.");
    this.emit();
    return { token: body.token };
  }

  // ── Apoyo ─────────────────────────────────────────────────────────────

  clockFor(serialNumber) {
    if (!serialNumber) return null;
    return this.clocks.find((clock) => clock.serialNumber === serialNumber) || null;
  }

  async api(method, path, body) {
    const config = this.config.read();
    const url = `${String(config.apiUrl || "").replace(/\/+$/, "")}${path}`;
    const headers = { Authorization: `Bearer ${this.config.getToken()}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`No se pudo conectar al API (${url}): ${messageOf(error)}`);
    }

    let json = null;
    const text = await response.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (response.status === 401 || response.status === 403) {
      this.state.tokenValid = false;
      if (response.status === 401) throw new ApiError(401, json && json.code, "Token de agente inválido o revocado");
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        json && json.code,
        (json && json.message) || `El API respondió ${response.status}`
      );
    }
    this.state.tokenValid = true;
    return json;
  }

  /** Lo que consume la ventana (sin token completo). */
  snapshot() {
    const config = this.config.publicConfig();
    return {
      configured: Boolean(config.tokenSet && config.apiUrl),
      apiUrl: config.apiUrl,
      tokenSet: config.tokenSet,
      chunkSeconds: config.chunkSeconds,
      jobsPollSeconds: config.jobsPollSeconds,
      heartbeatSeconds: config.heartbeatSeconds,
      autoStart: config.autoStart,
      version: this.version,
      agentId: this.state.agentId,
      tenantName: this.state.tenantName,
      tokenValid: this.state.tokenValid,
      running: this.state.running,
      busy: this.state.busy,
      lastHeartbeatAt: this.state.lastHeartbeatAt,
      lastSyncAt: this.state.lastSyncAt,
      lastError: this.state.lastError,
      pendingPunches: this.queue.length,
      pendingJobs: this.state.pendingJobs,
      clocks: this.clocks.map((clock) => ({
        serialNumber: clock.serialNumber,
        name: clock.name,
        url: clock.url,
        ok: clock.ok,
        lastSyncAt: clock.lastSyncAt,
        cursor: clock.cursor,
        pending: this.queue.filter((punch) => punch.clockSerial === clock.serialNumber).length,
        error: clock.error,
      })),
      logLines: this.logger.list().slice(-200),
    };
  }

  emit() {
    try {
      this.onState(this.snapshot());
    } catch {
      // Un fallo de la UI no debe tumbar el agente.
    }
  }
}

const requireFields = (payload, fields) => {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      throw new Error(`El trabajo no trae ${field}`);
    }
  }
};

module.exports = { AgentService, ApiError, messageOf };
