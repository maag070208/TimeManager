import { ITThemePalette, ITThemeProvider } from "@axzydev/axzy_ui_system";
import "@axzydev/axzy_ui_system/dist/index.css";
import "@shared/i18n/config";
import { store } from "@app/store";
import ToastProvider from "@app/toast/ToastProvider";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "@app/index.css";

if (!localStorage.getItem("it-theme-dark-mode")) {
  localStorage.setItem("it-theme-dark-mode", "light");
}

const customTheme: ITThemePalette = {
  primary: "#0D5777",
  secondary: "#1A7499",
  ternary: "#F0F4F7",
  alert: "#F9C74F",
  warning: "#F9C74F",
  danger: "#BA1A1A",
  info: "#512bbb",
  success: "#4ADE80",
  layout: {
    sidebarBg: "#ffffff",
    sidebarText: "#54634d",
    navbarBg: "#0D5777",
    navbarText: "#ffffff",
  },
  table: {
    headerBg: "#8ab1cf9d",
    headerText: "#0D5777",
    rowBg: "#ffffff",
    rowText: "#1B1B1F",
    rowHover: "#0d5777c4",
  },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ITThemeProvider theme={customTheme} showFab={false} density={0.80} appearance="bento">
        <ToastProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ToastProvider>
      </ITThemeProvider>
    </Provider>
  </React.StrictMode>
);