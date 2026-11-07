/**
 * Validación y formato de dispositivos TIC (SET-02 catálogos): códigos, MAC e
 * IPv4/IPv6 con el mismo criterio que la API.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IT_DEVICE_CODES,
  formatMacInput,
  isITDeviceCode,
  isValidIP,
  isValidIPv4,
  isValidIPv6,
  isValidMac,
} from "./itDevice.ts";

test("[SET-02] códigos de dispositivo válidos", () => {
  assert.deepEqual([...IT_DEVICE_CODES], ["PC", "TABLET", "LAPTOP"]);
  assert.equal(isITDeviceCode("PC"), true);
  assert.equal(isITDeviceCode("TABLET"), true);
  assert.equal(isITDeviceCode("PHONE"), false);
  assert.equal(isITDeviceCode(null), false);
});

test("[SET-02] MAC acepta AA:BB:CC:DD:EE:FF y AA-BB-CC-DD-EE-FF", () => {
  assert.equal(isValidMac("AA:BB:CC:DD:EE:FF"), true);
  assert.equal(isValidMac("aa-bb-cc-dd-ee-ff"), true);
  assert.equal(isValidMac(" AA:BB:CC:DD:EE:FF "), true);
  assert.equal(isValidMac("AA:BB:CC:DD:EE"), false);
  assert.equal(isValidMac("GG:BB:CC:DD:EE:FF"), false);
});

test("[SET-02] formatMacInput arma la máscara mientras se escribe", () => {
  assert.equal(formatMacInput("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(formatMacInput("aa bb cc"), "AA:BB:CC");
  assert.equal(formatMacInput("AABBCCDDEEFF0011"), "AA:BB:CC:DD:EE:FF", "trunca a 12 hex");
  assert.equal(formatMacInput(""), "");
});

test("[SET-02] IPv4 válidas y fuera de rango", () => {
  for (const ip of ["0.0.0.0", "192.168.1.50", "255.255.255.255", "10.0.0.1"]) {
    assert.equal(isValidIPv4(ip), true, ip);
  }
  for (const ip of ["256.1.1.1", "192.168.1", "192.168.1.1.1", "sin-ip", ""]) {
    assert.equal(isValidIPv4(ip), false, ip);
  }
});

test("[SET-02] IPv6 y agregado isValidIP", () => {
  assert.equal(isValidIPv6("::1"), true);
  assert.equal(isValidIPv6("2001:db8:85a3:0:0:8a2e:370:7334"), true);
  assert.equal(isValidIPv6("192.168.1.1"), false);
  assert.equal(isValidIP("10.0.0.5"), true);
  assert.equal(isValidIP("::"), true);
  assert.equal(isValidIP("no-es-ip"), false);
});
