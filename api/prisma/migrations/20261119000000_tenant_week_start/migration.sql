-- F2/F4 — Semana laboral configurable por cliente (p. ej. jueves→miércoles).
ALTER TABLE "tenants" ADD COLUMN "weekStartDay" INTEGER NOT NULL DEFAULT 3;
