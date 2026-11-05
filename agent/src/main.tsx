import { ITThemePalette, ITThemeProvider } from "@axzydev/axzy_ui_system";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./types";
import "./index.css";

localStorage.setItem("it-theme-dark-mode", "light");

/** Paleta de marca TimeManager (la misma de la web y los correos). */
const theme: ITThemePalette = {
  primary: "#1D2636",
  secondary: "#4A5568",
  ternary: "#F4F6FA",
  alert: "#E8920F",
  warning: "#F2A93B",
  danger: "#BA1A1A",
  info: "#2F6FDB",
  success: "#22A06B",
  layout: {
    sidebarBg: "#ffffff",
    sidebarText: "#1D2636",
    navbarBg: "#1D2636",
    navbarText: "#F4F6FA",
  },
  table: {
    headerBg: "#EEF0F5",
    headerText: "#1D2636",
    rowBg: "#ffffff",
    rowText: "#1D2636",
    rowHover: "#1D2636",
  },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ITThemeProvider theme={theme} showFab={false} density={0.9} appearance="bento">
      <App />
    </ITThemeProvider>
  </React.StrictMode>
);
