-- F1B-06 — API key por cliente/reloj para ingesta directa de checadas.
--
-- El reloj (o el agente en su nombre) sube checadas al API con su propia key:
-- la fila de `time_clocks` es la que ata serial + key + cliente. Solo se guarda
-- el hash SHA-256; la key en claro se muestra una vez al generarla/rotarla.
ALTER TABLE "time_clocks"
  ADD COLUMN "apiKeyHash" TEXT,
  ADD COLUMN "apiKeyPrefix" TEXT,
  ADD COLUMN "apiKeyCreatedAt" TIMESTAMP(3);
-- Una key no puede pertenecer a dos relojes.
CREATE UNIQUE INDEX "time_clocks_apiKeyHash_key" ON "time_clocks" ("apiKeyHash");
