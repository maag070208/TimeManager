# Mock ISAPI (pruebas locales)

Simula un reloj Hikvision en memoria, solo en `127.0.0.1`. **No toca ningún reloj real.**

## Levantar el mock

```bash
cd api && npx ts-node scripts/isapi-mock/server.ts      # puerto 4801 (MOCK_PORT)
```

- Usuario y contraseña: `mock` / `mock-pass-123` (`MOCK_USER`, `MOCK_PASS`).
- `GET  /__mock__/state` muestra personas, tarjetas y eventos (sin contraseñas).
- `POST /__mock__/reset` vuelve al estado inicial (8 personas, 1 tarjeta, 48 eventos).

## Probar el cliente del sistema contra el mock

```bash
cd api && npx ts-node -r tsconfig-paths/register scripts/isapi-mock/smoke.ts
```

Solo acepta `127.0.0.1`. Lee identidad, hora, conteo, padrón completo y eventos.

## Usar el mock desde la API local

Para que la API local use el mock, pon las credenciales del mock como variables de entorno al arrancarla (no en `.env`):

```bash
TIME_CLOCK_USER=mock TIME_CLOCK_PASS=mock-pass-123 npm run dev
```

Luego da de alta el reloj desde la web con la dirección `http://127.0.0.1:4801`.

**Cuidado:** esa instancia usa las mismas credenciales para todos los relojes. No la uses con relojes reales.

## Qué imita y qué no

- Imita: `deviceInfo`, `System/time`, `UserInfo` (Count, Search, Record, Modify, Delete), `CardInfo` (capabilities, Count, Search, SetUp, Delete), `AcsEvent` (búsqueda con paginación con 48 eventos iniciales) y **huellas**: captura simulada desde la estación (`CaptureFingerPrint`, calidad ajustable con `POST /__mock__/finger-quality`), alta asíncrona con progreso (`FingerPrintUpload`, `FingerPrint/Count`) y borrado.
- Límites: 300 personas y 300 tarjetas; páginas de 30. Todo vive en memoria: al reiniciar vuelve al estado inicial (8 personas, 1 tarjeta, 48 eventos).
- No imita: rostros, fotos, video ni eventos en vivo (los eventos se leen por polling, como el equipo real).
- Diferencia conocida: `Delete` de una persona que no existe responde OK. El reloj real puede responder error. Verificar con el probe antes de confiar en eso.

## Dónde se usa

- **E2E web**: `web/playwright.config.ts` levanta el mock como `webServer` en `127.0.0.1:4801`; `api/scripts/e2e-seed.ts` siembra el reloj de acme con serial `MOCK-SERIAL-0001` y URL del mock (con `lastSerialNo` alto para no mezclar los eventos sintéticos con las checadas sembradas).
- **Integración API**: `clock-credentials.flow.test.ts` lo levanta si no está arriba y prueba rotación de credenciales y sync; otros flujos (planes, relojes) apuntan sus relojes a la misma URL.
- **Carga**: `api/load/` usa el endpoint de ingesta del API, no el mock.
- Para levantarlo a mano: comando de arriba y registra el reloj en la web con `http://127.0.0.1:4801` y credenciales del mock (o credenciales por reloj desde su ficha).
