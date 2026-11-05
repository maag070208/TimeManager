-- F4 — Desconexión del propio sistema (NOM-037 4.11/7.3 e): las notificaciones
-- al teletrabajador fuera de su jornada se difieren a su siguiente jornada.
ALTER TABLE "notifications" ADD COLUMN "deferredUntil" TIMESTAMP(3);
CREATE INDEX "notifications_userId_deferredUntil_idx" ON "notifications"("userId", "deferredUntil");
