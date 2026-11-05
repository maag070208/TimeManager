"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Puente seguro entre la ventana (React) y el proceso principal: la UI nunca
 * recibe el token ni acceso a Node; solo estas operaciones y el estado.
 */
contextBridge.exposeInMainWorld("agent", {
  getState: () => ipcRenderer.invoke("agent:get-state"),
  saveConfig: (patch) => ipcRenderer.invoke("agent:save-config", patch),
  setToken: (token) => ipcRenderer.invoke("agent:set-token", token),
  register: () => ipcRenderer.invoke("agent:register"),
  syncNow: () => ipcRenderer.invoke("agent:sync-now"),
  testClock: (serialNumber) => ipcRenderer.invoke("agent:test-clock", serialNumber),
  rotateToken: () => ipcRenderer.invoke("agent:rotate-token"),
  exportLogs: () => ipcRenderer.invoke("agent:export-logs"),
  openLogsFolder: () => ipcRenderer.invoke("agent:open-logs-folder"),
  getVersion: () => ipcRenderer.invoke("agent:get-version"),
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("agent:state", handler);
    return () => ipcRenderer.removeListener("agent:state", handler);
  },
});
