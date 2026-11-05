import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import accessEn from "./locales/en/access.json";
import accessReportEn from "./locales/en/access-report.json";
import timeClockEn from "./locales/en/time-clock.json";
import schedulesEn from "./locales/en/schedules.json";
import overtimeEn from "./locales/en/overtime.json";
import weeklyAttendanceEn from "./locales/en/weekly-attendance.json";
import auditEn from "./locales/en/audit.json";
import authEn from "./locales/en/auth.json";
import custodyLettersEn from "./locales/en/custody-letters.json";
import disciplinaryReportsEn from "./locales/en/disciplinary-reports.json";
import commonEn from "./locales/en/common.json";
import departmentsEn from "./locales/en/departments.json";
import subareasEn from "./locales/en/subareas.json";
import deviceTypesEn from "./locales/en/device-types.json";
import deviceEn from "./locales/en/device.json";
import employeesEn from "./locales/en/employees.json";
import homeEn from "./locales/en/home.json";
import dashboardEn from "./locales/en/dashboard.json";
import inventoryEn from "./locales/en/inventory.json";
import notificationsEn from "./locales/en/notifications.json";
import reportsEn from "./locales/en/reports.json";
import materialOutputsEn from "./locales/en/material-outputs.json";
import ticketsEn from "./locales/en/tickets.json";
import usersEn from "./locales/en/users.json";
import catalogEn from "./locales/en/catalog.json";
import rolesEn from "./locales/en/roles.json";
import kitchenEn from "./locales/en/kitchen.json";
import langostinEn from "./locales/en/langostin.json";

import accessEs from "./locales/es/access.json";
import accessReportEs from "./locales/es/access-report.json";
import timeClockEs from "./locales/es/time-clock.json";
import schedulesEs from "./locales/es/schedules.json";
import overtimeEs from "./locales/es/overtime.json";
import weeklyAttendanceEs from "./locales/es/weekly-attendance.json";
import auditEs from "./locales/es/audit.json";
import authEs from "./locales/es/auth.json";
import custodyLettersEs from "./locales/es/custody-letters.json";
import disciplinaryReportsEs from "./locales/es/disciplinary-reports.json";
import commonEs from "./locales/es/common.json";
import departmentsEs from "./locales/es/departments.json";
import subareasEs from "./locales/es/subareas.json";
import deviceTypesEs from "./locales/es/device-types.json";
import deviceEs from "./locales/es/device.json";
import employeesEs from "./locales/es/employees.json";
import homeEs from "./locales/es/home.json";
import dashboardEs from "./locales/es/dashboard.json";
import inventoryEs from "./locales/es/inventory.json";
import notificationsEs from "./locales/es/notifications.json";
import reportsEs from "./locales/es/reports.json";
import materialOutputsEs from "./locales/es/material-outputs.json";
import ticketsEs from "./locales/es/tickets.json";
import usersEs from "./locales/es/users.json";
import catalogEs from "./locales/es/catalog.json";
import rolesEs from "./locales/es/roles.json";
import kitchenEs from "./locales/es/kitchen.json";
import langostinEs from "./locales/es/langostin.json";

export const defaultNS = "common" as const;

export const APP_LANGUAGES = ["es", "en"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const NS_LIST = [
  "common",
  "device",
  "device-types",
  "auth",
  "home",
  "dashboard",
  "custody-letters",
  "tickets",
  "users",
  "employees",
  "departments",
  "subareas",
  "inventory",
  "reports",
  "material-outputs",
  "notifications",
  "audit",
  "catalog",
  "roles",
  "disciplinary-reports",
  "access",
  "access-report",
  "time-clock",
  "schedules",
  "overtime",
  "weekly-attendance",
  "kitchen",
  "langostin",
] as const;

export const resources = {
  en: {
    common: commonEn,
    device: deviceEn,
    "device-types": deviceTypesEn,
    auth: authEn,
    home: homeEn,
    dashboard: dashboardEn,
    "custody-letters": custodyLettersEn,
    "disciplinary-reports": disciplinaryReportsEn,
    tickets: ticketsEn,
    users: usersEn,
    employees: employeesEn,
    departments: departmentsEn,
    subareas: subareasEn,
    inventory: inventoryEn,
    reports: reportsEn,
    "material-outputs": materialOutputsEn,
    notifications: notificationsEn,
    audit: auditEn,
    catalog: catalogEn,
    roles: rolesEn,
    access: accessEn,
    "access-report": accessReportEn,
    "time-clock": timeClockEn,
    schedules: schedulesEn,
    overtime: overtimeEn,
    "weekly-attendance": weeklyAttendanceEn,
    kitchen: kitchenEn,
    langostin: langostinEn,
  },
  es: {
    common: commonEs,
    device: deviceEs,
    "device-types": deviceTypesEs,
    auth: authEs,
    home: homeEs,
    dashboard: dashboardEs,
    "custody-letters": custodyLettersEs,
    "disciplinary-reports": disciplinaryReportsEs,
    tickets: ticketsEs,
    users: usersEs,
    employees: employeesEs,
    departments: departmentsEs,
    subareas: subareasEs,
    inventory: inventoryEs,
    reports: reportsEs,
    "material-outputs": materialOutputsEs,
    notifications: notificationsEs,
    audit: auditEs,
    catalog: catalogEs,
    roles: rolesEs,
    access: accessEs,
    "access-report": accessReportEs,
    "time-clock": timeClockEs,
    schedules: schedulesEs,
    overtime: overtimeEs,
    "weekly-attendance": weeklyAttendanceEs,
    kitchen: kitchenEs,
    langostin: langostinEs,
  },
} as const;

const STORAGE_KEY = "ptnv-language";

const storedLanguage =
  typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage ?? "es",
  fallbackLng: "es",
  defaultNS,
  ns: NS_LIST,
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;