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
import disciplinaryReportsEn from "./locales/en/disciplinary-reports.json";
import commonEn from "./locales/en/common.json";
import departmentsEn from "./locales/en/departments.json";
import subareasEn from "./locales/en/subareas.json";
import deviceTypesEn from "./locales/en/device-types.json";
import deviceEn from "./locales/en/device.json";
import employeesEn from "./locales/en/employees.json";
import dashboardEn from "./locales/en/dashboard.json";
import notificationsEn from "./locales/en/notifications.json";
import reportsEn from "./locales/en/reports.json";
import materialOutputsEn from "./locales/en/material-outputs.json";
import usersEn from "./locales/en/users.json";
import catalogEn from "./locales/en/catalog.json";
import rolesEn from "./locales/en/roles.json";
import plansEn from "./locales/en/plans.json";
import ticEn from "./locales/en/tic.json";
import homeEn from "./locales/en/home.json";
import nomEn from "./locales/en/nom.json";

import accessEs from "./locales/es/access.json";
import accessReportEs from "./locales/es/access-report.json";
import timeClockEs from "./locales/es/time-clock.json";
import schedulesEs from "./locales/es/schedules.json";
import overtimeEs from "./locales/es/overtime.json";
import weeklyAttendanceEs from "./locales/es/weekly-attendance.json";
import auditEs from "./locales/es/audit.json";
import authEs from "./locales/es/auth.json";
import disciplinaryReportsEs from "./locales/es/disciplinary-reports.json";
import commonEs from "./locales/es/common.json";
import departmentsEs from "./locales/es/departments.json";
import subareasEs from "./locales/es/subareas.json";
import deviceTypesEs from "./locales/es/device-types.json";
import deviceEs from "./locales/es/device.json";
import employeesEs from "./locales/es/employees.json";
import dashboardEs from "./locales/es/dashboard.json";
import notificationsEs from "./locales/es/notifications.json";
import reportsEs from "./locales/es/reports.json";
import materialOutputsEs from "./locales/es/material-outputs.json";
import usersEs from "./locales/es/users.json";
import catalogEs from "./locales/es/catalog.json";
import rolesEs from "./locales/es/roles.json";
import plansEs from "./locales/es/plans.json";
import ticEs from "./locales/es/tic.json";
import homeEs from "./locales/es/home.json";
import nomEs from "./locales/es/nom.json";

export const defaultNS = "common" as const;

export const APP_LANGUAGES = ["es", "en"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const NS_LIST = [
  "common",
  "device",
  "device-types",
  "auth",
  "dashboard",
  "users",
  "employees",
  "departments",
  "subareas",
  "reports",
  "material-outputs",
  "notifications",
  "audit",
  "catalog",
  "roles",
  "plans",
  "disciplinary-reports",
  "access",
  "access-report",
  "time-clock",
  "schedules",
  "overtime",
  "weekly-attendance",
  "tic",
  "home",
  "nom",
] as const;

export const resources = {
  en: {
    common: commonEn,
    device: deviceEn,
    "device-types": deviceTypesEn,
    auth: authEn,
    dashboard: dashboardEn,
    "disciplinary-reports": disciplinaryReportsEn,
    users: usersEn,
    employees: employeesEn,
    departments: departmentsEn,
    subareas: subareasEn,
    reports: reportsEn,
    "material-outputs": materialOutputsEn,
    notifications: notificationsEn,
    audit: auditEn,
    catalog: catalogEn,
    roles: rolesEn,
    plans: plansEn,
    access: accessEn,
    "access-report": accessReportEn,
    "time-clock": timeClockEn,
    schedules: schedulesEn,
    overtime: overtimeEn,
    "weekly-attendance": weeklyAttendanceEn,
    tic: ticEn,
    home: homeEn,
    nom: nomEn,
  },
  es: {
    common: commonEs,
    device: deviceEs,
    "device-types": deviceTypesEs,
    auth: authEs,
    dashboard: dashboardEs,
    "disciplinary-reports": disciplinaryReportsEs,
    users: usersEs,
    employees: employeesEs,
    departments: departmentsEs,
    subareas: subareasEs,
    reports: reportsEs,
    "material-outputs": materialOutputsEs,
    notifications: notificationsEs,
    audit: auditEs,
    catalog: catalogEs,
    roles: rolesEs,
    plans: plansEs,
    access: accessEs,
    "access-report": accessReportEs,
    "time-clock": timeClockEs,
    schedules: schedulesEs,
    overtime: overtimeEs,
    "weekly-attendance": weeklyAttendanceEs,
    tic: ticEs,
    home: homeEs,
    nom: nomEs,
  },
} as const;

const STORAGE_KEY = "tm-language";

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