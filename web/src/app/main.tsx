import { ITThemePalette, ITThemeProvider } from "@axzydev/axzy_ui_system";
import "@axzydev/axzy_ui_system/dist/index.css";
import "@shared/i18n/config";
import { store } from "@app/store";
import ToastProvider from "@app/toast/ToastProvider";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import TenantHashRouter from "./TenantHashRouter";
import "@app/index.css";

if (!localStorage.getItem("it-theme-dark-mode")) {
  localStorage.setItem("it-theme-dark-mode", "light");
}

/** Paleta de marca TimeManager (brand/TimeManager-brand-package). Espejo en `--tm-*` de index.css. */
const customTheme: ITThemePalette = {
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
    <Provider store={store}>
      <ITThemeProvider theme={customTheme} showFab={false} density={0.80} appearance="bento">
        <ToastProvider>
          <TenantHashRouter>
            <App />
          </TenantHashRouter>
        </ToastProvider>
      </ITThemeProvider>
    </Provider>
  </React.StrictMode>
);