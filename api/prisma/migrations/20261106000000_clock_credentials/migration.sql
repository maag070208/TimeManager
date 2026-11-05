-- F1B-10 — Credenciales del reloj por reloj, cifradas en reposo.
--
-- Cada cliente instala su propio reloj y cada equipo tiene su admin: el par
-- TIME_CLOCK_USER/PASS del `.env` deja de ser la única fuente. Estas dos
-- columnas guardan el usuario y la contraseña (AES-256-GCM, `core/utils/crypto`)
-- de cada reloj.
--
-- Backfill: no se puede leer el `.env` desde SQL. Los relojes ya dados de alta
-- siguen funcionando con el par global como fallback (misma precedencia:
-- credenciales del reloj → `.env`); al editar el reloj se capturan las suyas y
-- el fallback deja de usarse. No hay pérdida de datos ni ventana de fallo.
ALTER TABLE "time_clocks"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "passwordEncrypted" TEXT;
