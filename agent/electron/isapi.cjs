"use strict";

/**
 * Cliente ISAPI del reloj Hikvision para el agente local.
 *
 * Copia deliberada (sin dependencias) del cliente del API
 * (`api/src/modules/time-clock/services/isapi.client.ts`): el agente corre en la
 * red del cliente y habla directo con el equipo. Autenticación HTTP Digest hecha
 * a mano; con https se acepta el certificado autofirmado del reloj (la conexión
 * va cifrada, sin validar identidad, igual que el API).
 *
 * Lectura: identidad, hora, búsqueda de eventos y cotas de consecutivos.
 * Escritura: alta/baja de personas, tarjetas y huellas (solo para los trabajos
 * que pide el panel; el agente no escribe configuración del equipo).
 */

const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { request: httpRequest } = require("node:http");
const { request: httpsRequest } = require("node:https");

const PAGE_SIZE = 30;
const MAX_SERIAL_NO = 2_147_483_647;
const ANY_TIME = {
  startTime: "2000-01-01T00:00:00+00:00",
  endTime: "2037-12-31T23:59:59+00:00",
};

class IsapiAuthError extends Error {
  constructor() {
    super("The time clock rejected the credentials");
    this.name = "IsapiAuthError";
  }
}

const xmlTag = (xml, name) => {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return match ? match[1].trim() : undefined;
};

const safeJson = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

const findNumber = (value, key) => {
  if (value === null || typeof value !== "object") return undefined;
  if (key in value && Number.isFinite(Number(value[key]))) return Number(value[key]);
  for (const child of Object.values(value)) {
    const hit = findNumber(child, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

const parseChallenge = (header) => {
  const params = {};
  const pairs = header.replace(/^Digest\s+/i, "").matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g);
  for (const [, key, quoted, bare] of pairs) params[key.toLowerCase()] = quoted ?? bare;
  return params;
};

const digestAuthorization = (challenge, method, uri, user, pass) => {
  const sha256 = (challenge.algorithm || "").toUpperCase() === "SHA-256";
  const hash = (value) => createHash(sha256 ? "sha256" : "md5").update(value).digest("hex");
  const qop = (challenge.qop || "").split(",").map((item) => item.trim()).includes("auth")
    ? "auth"
    : undefined;
  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");
  const ha1 = hash(`${user}:${challenge.realm}:${pass}`);
  const ha2 = hash(`${method}:${uri}`);
  const response = qop
    ? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : hash(`${ha1}:${challenge.nonce}:${ha2}`);

  const fields = [
    `username="${user}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.algorithm) fields.push(`algorithm=${challenge.algorithm}`);
  if (challenge.opaque !== undefined) fields.push(`opaque="${challenge.opaque}"`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${fields.join(", ")}`;
};

const describeIsapiError = (body) => {
  const json = safeJson(body);
  if (json && typeof json === "object") {
    const parts = [json.statusString, json.subStatusCode, json.errorMsg].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
  }
  const parts = [xmlTag(body, "statusString"), xmlTag(body, "subStatusCode")].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : String(body || "").slice(0, 200);
};

class IsapiClient {
  constructor(baseUrl, user, pass, timeoutMs = 30000) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.pass = pass;
    this.timeoutMs = timeoutMs;
  }

  /** Identidad del equipo (`GET /ISAPI/System/deviceInfo`). */
  async deviceInfo() {
    const xml = await this.send("GET", "/ISAPI/System/deviceInfo");
    const serialNumber = xmlTag(xml, "serialNumber");
    if (!serialNumber) throw new Error("The time clock did not report its serial number");
    return {
      serialNumber,
      model: xmlTag(xml, "model") || null,
      deviceName: xmlTag(xml, "deviceName") || null,
      firmwareVersion: xmlTag(xml, "firmwareVersion") || null,
    };
  }

  /** Hora del equipo (`GET /ISAPI/System/time`). */
  async time() {
    const xml = await this.send("GET", "/ISAPI/System/time");
    const localTime = xmlTag(xml, "localTime");
    const instant = localTime ? new Date(localTime) : null;
    if (!instant || Number.isNaN(instant.getTime())) {
      throw new Error("The time clock did not report its time");
    }
    return { localTime, instant, timeMode: xmlTag(xml, "timeMode") || null };
  }

  /**
   * Cota segura de consecutivos desde `fromSerialNo`: el mayor consecutivo que
   * ya existe con seguridad en el reloj, o `null` si no hay eventos. Todo
   * consecutivo menor o igual ya está en el equipo.
   */
  async lastSerialNo(fromSerialNo) {
    const from = Math.max(1, Number(fromSerialNo) || 1);
    const body = await this.send(
      "POST",
      "/ISAPI/AccessControl/AcsEvent?format=json",
      JSON.stringify({
        AcsEventCond: {
          searchID: randomUUID(),
          searchResultPosition: 0,
          maxResults: 1,
          major: 5,
          minor: 0,
          ...ANY_TIME,
          beginSerialNo: from,
          endSerialNo: MAX_SERIAL_NO,
          timeReverseOrder: true,
          picEnable: false,
        },
      })
    );
    const page = this.parseAcsEventPage(body);
    if (!page.totalMatches) return null;
    const newest = page.InfoList && page.InfoList[0] ? Number(page.InfoList[0].serialNo) || 0 : 0;
    return Math.max(from + page.totalMatches - 1, newest);
  }

  /** Eventos de un subtipo (`minor`) entre dos consecutivos, página por página. */
  async *acsEvents(fromSerialNo, toSerialNo, minor) {
    const searchID = randomUUID();
    let position = 0;
    for (;;) {
      const body = await this.send(
        "POST",
        "/ISAPI/AccessControl/AcsEvent?format=json",
        JSON.stringify({
          AcsEventCond: {
            searchID,
            searchResultPosition: position,
            maxResults: PAGE_SIZE,
            major: 5,
            minor,
            ...ANY_TIME,
            beginSerialNo: Math.max(1, Number(fromSerialNo) || 1),
            endSerialNo: Math.min(Number(toSerialNo) || MAX_SERIAL_NO, MAX_SERIAL_NO),
            picEnable: false,
          },
        })
      );
      const page = this.parseAcsEventPage(body);
      const events = page.InfoList || [];
      if (events.length > 0) yield { totalMatches: page.totalMatches, events };
      position += events.length;
      if (page.responseStatusStrg !== "MORE" || events.length === 0) return;
    }
  }

  // ── Escritura (trabajos del panel) ────────────────────────────────────

  async userAdd(person) {
    await this.writeOk("POST", "/ISAPI/AccessControl/UserInfo/Record?format=json", {
      UserInfo: {
        employeeNo: person.employeeNumber,
        name: person.name,
        userType: "normal",
        gender: person.gender || "unknown",
        Valid: {
          enable: true,
          beginTime: "2020-01-01T00:00:00",
          endTime: "2036-12-31T23:59:59",
          timeType: "local",
        },
        doorRight: "1",
        RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
        localUIRight: false,
        userVerifyMode: "",
      },
    });
  }

  async userModify(person) {
    await this.writeOk("PUT", "/ISAPI/AccessControl/UserInfo/Modify?format=json", {
      UserInfo: { employeeNo: person.employeeNumber, name: person.name, userType: "normal" },
    });
  }

  async userDelete(employeeNumber) {
    await this.writeOk("PUT", "/ISAPI/AccessControl/UserInfo/Delete?format=json", {
      UserInfoDelCond: { EmployeeNoList: [{ employeeNo: employeeNumber }] },
    });
  }

  async cardAdd(employeeNumber, cardNo) {
    await this.writeOk("PUT", "/ISAPI/AccessControl/CardInfo/SetUp?format=json", {
      CardInfo: {
        employeeNo: employeeNumber,
        cardNo,
        cardType: "normalCard",
        checkCardNo: true,
        checkEmployeeNo: true,
      },
    });
  }

  async cardDelete(cardNo) {
    await this.writeOk("PUT", "/ISAPI/AccessControl/CardInfo/Delete?format=json", {
      CardInfoDelCond: { CardNoList: [{ cardNo }] },
    });
  }

  /** Empieza el alta de una huella (`POST FingerPrintDownload`). Es asíncrona. */
  async fingerprintAdd(input) {
    await this.writeOk("POST", "/ISAPI/AccessControl/FingerPrintDownload?format=json", {
      FingerPrintCfg: {
        employeeNo: input.employeeNumber,
        enableCardReader: [1],
        fingerPrintID: input.fingerPrintID,
        fingerType: "normalFP",
        fingerData: input.fingerData,
      },
    });
  }

  /** ¿Terminó el alta de huella en curso? (`totalStatus` 1 = terminó). */
  async fingerprintApplied() {
    const body = await this.send("GET", "/ISAPI/AccessControl/FingerPrintProgress?format=json");
    return findNumber(safeJson(body), "totalStatus") === 1;
  }

  // ── Apoyo ─────────────────────────────────────────────────────────────

  parseAcsEventPage(body) {
    const page = (safeJson(body) || {}).AcsEvent;
    if (!page || typeof page !== "object") {
      throw new Error(`Unexpected response from the time clock: ${describeIsapiError(body)}`);
    }
    return page;
  }

  async writeOk(method, path, payload) {
    const body = await this.send(method, path, JSON.stringify(payload));
    const status = safeJson(body) || {};
    if (Number(status.statusCode) !== 1 && status.statusString !== "OK") {
      throw new Error(`The time clock rejected the operation: ${describeIsapiError(body)}`);
    }
  }

  send(method, path, body, contentType) {
    return this.exchange(method, new URL(path, this.baseUrl), body, contentType).then(
      (response) => response.body
    );
  }

  async exchange(method, url, body, contentType) {
    const headers = body ? { "Content-Type": contentType || "application/json" } : {};
    let response = await this.request(url, method, headers, body);
    if (response.status === 401) {
      const challenge = String(response.headers["www-authenticate"] || "");
      if (!/^Digest\s/i.test(challenge)) {
        throw new Error(
          `The time clock did not offer Digest authentication (${challenge || "no challenge"})`
        );
      }
      headers.Authorization = digestAuthorization(
        parseChallenge(challenge),
        method,
        url.pathname + url.search,
        this.user,
        this.pass
      );
      response = await this.request(url, method, headers, body);
      if (response.status === 401) throw new IsapiAuthError();
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `The time clock answered ${response.status} on ${url.pathname}: ${describeIsapiError(response.body)}`
      );
    }
    return response;
  }

  request(url, method, headers, body) {
    return new Promise((resolve, reject) => {
      const failure = (error) => {
        const code = error.code ? ` [${error.code}]` : "";
        reject(new Error(`Could not connect to the time clock (${this.baseUrl}): ${error.message}${code}`));
      };
      const onResponse = (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks);
          resolve({ status: response.statusCode || 0, headers: response.headers, raw, body: raw.toString("utf8") });
        });
        response.on("error", failure);
      };
      const options = {
        method,
        headers: body ? { ...headers, "Content-Length": String(Buffer.byteLength(body)) } : headers,
        timeout: this.timeoutMs,
      };
      const request =
        url.protocol === "https:"
          ? httpsRequest(url, { ...options, rejectUnauthorized: false }, onResponse)
          : httpRequest(url, options, onResponse);
      request.on("timeout", () => request.destroy(new Error(`no response in ${this.timeoutMs / 1000} s`)));
      request.on("error", failure);
      request.end(body);
    });
  }
}

module.exports = { IsapiClient, IsapiAuthError };
