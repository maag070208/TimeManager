# Mejoras y hallazgos de QA — CheckLab

Campaña iniciada: **2026-11-08**.

Este documento reúne mejoras de producto y del sistema de pruebas encontradas por los bots de API, WEB y APP. Ningún hallazgo se marca como resuelto sin una nueva ejecución que lo confirme.

## Resumen

| Severidad | Abiertos | Resueltos verificados |
|---|---:|---:|
| BLOQUEANTE | 0 | 0 |
| ALTA | 0 | 0 |
| MEDIA | 0 | 0 |
| BAJA | 0 | 0 |

## Convención

- `QAINF-*`: mejora del arnés, cobertura o evidencia de pruebas.
- `BUG-*`: comportamiento incorrecto reproducible del producto.
- `GAP-*`: funcionalidad ausente o pendiente ya delimitada por el producto.
- Severidad: `BLOQUEANTE`, `ALTA`, `MEDIA`, `BAJA`.
- Estado: `PROPUESTA`, `EN CURSO`, `RESUELTO POR VERIFICAR`, `RESUELTO`, `DESCARTADO` con justificación.

## Mejoras del sistema de pruebas

### QAINF-001 — Incorporar APP y resultados de ejecución a la matriz maestra

- **Severidad:** MEDIA
- **Estado:** RESUELTO
- **Evidencia:** `docs/QA_BOTS_MATRIX.md` incluye API, WEB, APP Android/iOS, recorridos cruzados, roles, modos, estados y artefactos.
- **Resultado:** la cobertura deja de limitarse a pantallas WEB/API y distingue cobertura estática de ejecución exitosa.

### QAINF-002 — Actualizar cifras históricas de cobertura en la documentación

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Origen:** inventario estático del 2026-11-08.
- **Actual:** `docs/QA_MATRIX.md` conserva el resumen y huecos del 2026-11-06; el inventario actual reconoce 125 archivos de prueba y los 196 IDs atómicos aparecen etiquetados.
- **Mejora:** separar “inventario actual”, “cobertura estática” y “última ejecución”, actualizando cifras desde el reporte generado en vez de mantenerlas manualmente.

### QAINF-003 — Añadir bots E2E de UI para Android e iOS

- **Severidad:** ALTA
- **Estado:** PROPUESTA
- **Actual:** la APP tiene pruebas comunes con `MockEngine`, pero no se encontró una suite Maestro/Appium/Compose UI que recorra los flujos reales contra el stack local.
- **Mejora:** automatizar login/sesión, checada online/offline, GPS, permisos, aprobaciones, personal, horarios, nómina, relojes y configuración en ambas plataformas; conservar capturas y logs por fallo.

### QAINF-004 — Consolidar resultados de API, WEB y APP

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Mejora:** una corrida debe producir resumen por superficie, pasos/fallos, duración, ambiente, artefactos y enlaces a hallazgos, sin presentar suites no ejecutadas como aprobadas.

### QAINF-005 — Ampliar pruebas cruzadas WEB ↔ APP ↔ API

- **Severidad:** ALTA
- **Estado:** PROPUESTA
- **Mejora:** verificar con el mismo dataset checada e idempotencia, permisos, vacaciones, horarios, tiempo extra, nómina, bajas y aislamiento entre clientes, según `E2E-01..E2E-10` de la matriz maestra.

## Hallazgos de producto

Todavía no hay fallos de producto confirmados en esta campaña. Se agregarán sólo después de reproducirlos con evidencia.

## Brechas de alcance conocidas

Estas brechas proceden de la documentación vigente de la APP; se validarán durante la ejecución, pero no se contabilizan como regresiones nuevas.

| ID | Brecha documentada | Tratamiento QA |
|---|---|---|
| GAP-APP-001 | Mapa nativo pendiente; actualmente se abre mapa externo | Probar fallback y no anunciar mapa nativo |
| GAP-APP-002 | Push FCM/APNs pendiente | Probar bandeja API; push queda manual/futuro |
| GAP-APP-003 | Subida de documentos al expediente pendiente en APP | Distinguir ausencia conocida de fallos en funciones existentes |
| GAP-APP-004 | Edición de permisos por rol permanece en WEB | En APP probar consulta/guards, no exigir edición |
| GAP-APP-005 | Traducción al inglés pendiente en APP | No marcar APP-es como paridad i18n completa |
| GAP-APP-006 | Screenshot tests pendientes | Añadir evidencia visual de pantallas críticas |

## Registro de ejecuciones

| Fecha | Superficie | Alcance | Resultado | Evidencia |
|---|---|---|---|---|
| 2026-11-08 | Inventario | Matriz y cobertura estática | 125 archivos; 196/196 IDs atómicos etiquetados; no implica ejecución exitosa | Salida de `scripts/qa-coverage.mjs --json` |
