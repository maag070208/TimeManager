# Mejoras y hallazgos de QA — CheckLab

Campaña iniciada: **2026-11-08**.

Este documento reúne mejoras de producto y del sistema de pruebas encontradas por los bots de API, WEB y APP. Ningún hallazgo se marca como resuelto sin una nueva ejecución que lo confirme.

## Resumen

| Severidad | Abiertos | Resueltos verificados |
|---|---:|---:|
| BLOQUEANTE | 0 | 0 |
| ALTA | 0 | 0 |
| MEDIA | 6 | 0 |
| BAJA | 9 | 0 |

El resumen contabiliza los 15 hallazgos de producto `BUG-001..015`; las propuestas `QAINF` y las brechas conocidas se gestionan por separado.

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

### QAINF-006 — Aplicar migraciones y cargar el entorno correcto antes de sembrar

- **Severidad:** MEDIA
- **Estado:** RESUELTO
- **Actual:** la base local `tm_e2e` conservaba un esquema anterior y el seed fallaba; el arnés de bots tampoco cargaba el catálogo de permisos con `NODE_ENV=test`.
- **Mejora aplicada:** `web/tests/e2e/global-setup.ts` ejecuta `prisma migrate deploy` antes del seed; `api/qa/run-local.mjs` usa el entorno de desarrollo local y valida que la base sea `tm_qa*`.
- **Resultado:** las corridas parten del esquema y la matriz de permisos vigentes sin tocar datos externos.

### QAINF-007 — Eliminar selectores frágiles y supuestos dependientes del orden

- **Severidad:** MEDIA
- **Estado:** RESUELTO
- **Actual:** varias pruebas WEB dependían de textos o rutas cambiables, fechas que se traslapaban con el seed, orden de filas y contenido de pestañas no abiertas.
- **Mejora aplicada:** se corrigieron selectores y datos de `client-routes`, `home`, `landing`, `client-settings`, `mi-jornada`, `nom-portal`, `access-time-clock`, `time-clocks` y `platform-console`; los casos afectados se repitieron con éxito.
- **Mejora pendiente:** conservar esta disciplina en suites nuevas y evitar corregir aserciones sin comprobar primero si el cambio corresponde al contrato vigente.

## Hallazgos de producto

### BUG-001 — El reseteo de contraseña no cierra las sesiones abiertas

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** API / autenticación
- **Evidencia:** bot `personal-roles`; tras `PUT /users/:id/password`, el access token anterior sigue respondiendo `GET /auth/me` con 200 y el refresh anterior también conserva capacidad de renovación.
- **Riesgo:** si el reseteo responde a una cuenta comprometida, quien posee una sesión previa conserva acceso hasta que venza el token.
- **Mejora:** versionar o revocar sesiones al restablecer contraseña; invalidar access/refresh previos y añadir una prueba de regresión para ambos.

### BUG-002 — Un token previo a la baja vuelve a servir tras reactivar

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / autenticación y ciclo de vida de personal
- **Evidencia:** bot `personal-roles`; `GET /auth/me` con el access token previo a `PATCH /users/:id/deactivate` vuelve a responder 200 después de `/reactivate`.
- **Actual:** la baja sólo pausa la sesión mientras `active=false`; no revoca el token.
- **Mejora:** invalidar sesiones al desactivar y no rehabilitar tokens antiguos al reactivar; exigir un inicio de sesión nuevo.

### BUG-003 — El cambio obligatorio de contraseña sólo lo exige la WEB

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / APP
- **Evidencia:** bot `personal-roles`; con contraseña provisional y `mustChangePassword=true`, `GET /nom/me/punches` responde 200.
- **Riesgo:** una APP o cliente propio puede omitir el cambio obligatorio y seguir operando con la contraseña provisional.
- **Mejora:** aplicar la restricción en el middleware del API, permitiendo únicamente los endpoints necesarios para cambiar contraseña y cerrar sesión.

### BUG-004 — Un admin de cliente puede otorgar permisos de plataforma

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / RBAC
- **Evidencia:** bot `personal-roles`; `PUT /users/:id/permissions/tenants.view` con `{scope:ALL}` responde 200; también se observó con `plans.view` y `catalogs.manage`.
- **Actual:** `requiresPlatform` neutraliza el acceso a las rutas de plataforma, pero la consola permite asignar capacidades que no corresponden al ámbito del cliente.
- **Mejora:** filtrar el catálogo asignable por tipo de actor y validar en servidor que los permisos de plataforma sólo los gestione plataforma.

### BUG-005 — No existe una vía para rechazar el acuerdo del método de registro

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / APP / cumplimiento NOM
- **Evidencia:** bot `nom-cumplimiento`, 181/182 pasos; `POST /nom/me/record-agreement/reject` responde 404 `ROUTE_NOT_FOUND`. Las rutas actuales sólo exponen consulta, propuesta y aceptación del trabajador, además de listado/firma patronal.
- **Actual:** no hay estado de rechazo visible para RH ni endpoint para que RH/admin proponga el acuerdo a una persona. La WEB conserva textos de rechazo, pero no una llamada API asociada.
- **Mejora:** definir el flujo de dos partes con estados pendiente/aceptado/rechazado, motivo e historial; añadir la acción de rechazo y la propuesta por RH, con sus guardas y pruebas de aislamiento.

### BUG-006 — Un marcaje corregido a otro día desaparece de la vista diaria

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / tiempo extra
- **Evidencia:** bot `horas-extra`; Bruno marcó el 2026-11-08 y sus marcajes quedaron corregidos y aprobados al 2026-11-04. La consulta semanal muestra 480 min ese día, pero la consulta `DAY` para 2026-11-04 no devuelve a Bruno y el barrido diario no crea la alerta esperada.
- **Causa localizada:** el reporte filtra los marcajes remotos por su `occurredAt` original y aplica los ajustes después (`time-clock-report.service.ts`).
- **Impacto:** aprobación diaria, exportación y alertas diarias omiten trabajo corregido.
- **Mejora:** seleccionar marcajes por fecha efectiva ajustada, o incluir los originales cuyo ajuste aprobado caiga en el periodo; añadir regresiones para entrada/salida movidas entre días.

### BUG-007 — La aprobación y el ledger semanal calculan extras distintos

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / nómina / tiempo extra
- **Evidencia:** bot `horas-extra`; para Bruno, turno 07:00–15:00 y trabajo 05:00–23:00 del 2026-11-04, `/overtime/query` calcula 480 min, mientras `/nom/overtime/weekly` calcula 600 min (240 dobles + 360 excedentes).
- **Causa localizada:** la aprobación sólo cuenta tiempo después de la salida programada; el motor semanal usa trabajado menos programado.
- **Impacto:** RH aprueba una cifra y la constancia/exportación muestra otra para el mismo día.
- **Mejora:** unificar la regla de cómputo —incluido tiempo anterior al turno— en un único servicio y cruzar sus totales en pruebas de contrato.

### BUG-008 — RH puede congelar el ledger sin permiso de aprobación

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / RBAC / tiempo extra
- **Evidencia:** bot `horas-extra`; `POST /nom/overtime/weekly/:id/confirm` con HUMAN_RESOURCES responde 200 y deja `CONFIRMED`, aunque ese rol no tiene `overtime.approve` ni puede aprobar días.
- **Causa localizada:** la ruta exige `time_clock.write`; la documentación del módulo indica `overtime.approve`.
- **Mejora:** alinear ruta, matriz y documentación; si confirmar congela cifras, exigir el permiso de aprobación y probar admin permitido/RH denegado.

### BUG-009 — Firmar después de objetar elimina la objeción visible

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / constancias de jornada
- **Evidencia:** bot `horas-extra`; Bruno objetó su semana y después la firmó. El mismo registro pasó a `ACCEPTED` con `discrepancyNote=null`, por lo que RH dejó de ver la objeción; sólo permanece en auditoría.
- **Mejora:** conservar historial de objeciones y resolución, impedir borrar la nota al cambiar de estado o exigir una resolución explícita por RH antes de aceptar.

### BUG-010 — Crear o editar horarios no devuelve avisos de legalidad

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / horarios
- **Evidencia:** bot `horarios`; `POST /schedules` con L–V 07:00–15:00 y `mealBreakMin=0` responde 201 sin `warnings`. La documentación H-02 indica que los avisos no bloquean, pero sí se devuelven.
- **Causa localizada:** el servicio comprueba `legality.valid` y descarta `legality.warnings`.
- **Mejora:** incluir los avisos en altas/ediciones y mostrarlos en la WEB sin impedir guardar horarios válidos.

### BUG-011 — Se acepta un día laboral con entrada y sin salida

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / APP / horarios
- **Evidencia:** bot `horarios`; `POST /schedules` con un día `{weekday:1,startTime:"09:00"}` responde 201. La legalidad lo contabiliza como 0 h y la jornada queda sin salida programada.
- **Mejora:** añadir validación cruzada en el DTO: los días laborales deben tener entrada y salida; ambas deben omitirse únicamente en descanso.

### BUG-012 — Reasignar hacia atrás deja vigencias históricas contradictorias

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / APP / asistencia
- **Evidencia:** bot `horarios`; Irene tenía Corrido desde 2026-10-28 y Matutino desde 2026-11-08. Al asignar “hoy a tiempo” desde 2026-10-21, la consulta muestra sólo la nueva asignación, pero la asistencia del 2026-11-04 al 2026-11-07 sigue calculando con Corrido.
- **Causa localizada:** la asignación masiva no elimina una vigencia ya cerrada que comenzó después del nuevo `from`; el cálculo prefiere esa vigencia por tener inicio más reciente.
- **Mejora:** resolver todos los solapes —abiertos y cerrados— dentro del periodo reemplazado y comprobar que consulta y cálculo usen exactamente la misma vigencia.

### BUG-013 — La pre-nómina acepta una semana con fecha no alineada

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / APP / nómina
- **Evidencia:** bot `horarios`; `PUT /schedules/payroll/reviews` con `weekStart=2026-11-06` responde 200 aunque el inicio de semana configurado es 2026-11-04.
- **Riesgo:** revisiones y cierres quedan asociados a una clave que las pantallas no consultan.
- **Mejora:** validar que `weekStart` coincida con el inicio configurado para el cliente o normalizarlo de forma explícita y consistente.

### BUG-014 — No se puede borrar un horario inactivo con historial

- **Severidad:** BAJA
- **Estado:** PROPUESTA
- **Superficie:** API / WEB / horarios
- **Evidencia:** bot `horarios`; `DELETE /schedules/:id` sobre Corrido inactivo, sin asignaciones abiertas pero con historial cerrado, responde 400 `INVALID_REFERENCE` por la llave foránea de asignaciones.
- **Causa localizada:** el servicio intenta borrado físico cuando no hay asignaciones abiertas, sin considerar las cerradas.
- **Mejora:** conservar borrado lógico cuando exista cualquier historial o definir archivado explícito; no exponer errores de integridad como respuesta de negocio ambigua.

### BUG-015 — El catálogo no muestra el alta recién guardada

- **Severidad:** MEDIA
- **Estado:** PROPUESTA
- **Superficie:** WEB / catálogos
- **Evidencia:** Playwright `platform-settings.spec.ts`, alta de tipo de permiso: el diálogo cierra y el contador cambia de 4 a 5 configurados, pero la tabla sigue mostrando 4 filas y no contiene el nuevo nombre después de 20 s. También se reproduce en `platform-plans.spec.ts`: `createPlanViaUi` guarda, pero la fila `Plan QA …` no aparece después de 30 s.
- **Impacto:** la persona usuaria no ve ni puede editar/dar de baja el registro que acaba de crear sin refrescar o cambiar de pestaña. Que ocurra en catálogos y planes apunta a un problema compartido de tablas o estado, no a un formulario aislado.
- **Mejora:** sincronizar los datos de `ITDataTable` tras mutaciones y al terminar la carga inicial; añadir pruebas que exijan la fila nueva sin recargar ni remontar la pestaña en ambos catálogos.

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
| 2026-11-08 | API | Unitarias | 146/146 | `npm --prefix api run test:unit` |
| 2026-11-08 | API | Integración, 69 suites | 223/223 | `npm --prefix api run test:integration` |
| 2026-11-08 | API | Bot `sesiones` | 37/37 | `api/qa`; sin hallazgos |
| 2026-11-08 | API | Bot `personal-roles` | 229/229; 4 desviaciones de seguridad/ciclo de vida | BUG-001..004 |
| 2026-11-08 | API | Bot `permisos` | 148/148 | `api/qa`; sin hallazgos adicionales |
| 2026-11-08 | API | Bot `jornada` | 183/183 | `api/qa`; sin hallazgos |
| 2026-11-08 | API | Bot `nom-cumplimiento` | 181/182 | BUG-005 |
| 2026-11-08 | API | Bot `horas-extra` | 212/215; 4 hallazgos | BUG-006..009 |
| 2026-11-08 | API | Bot `horarios` | 192/197; 5 hallazgos | BUG-010..014 |
| 2026-11-08 | API | Aislamiento entre clientes | 13 comprobaciones correctas | `tenancy-check` sobre `tm_qa` local |
| 2026-11-08 | API | Build y lint | Build correcto; lint sin errores, 155 warnings | Salida de build/lint |
| 2026-11-08 | WEB | Unitarias | 90/90 | `npm --prefix web run test:unit` |
| 2026-11-08 | WEB | Build y lint | Build correcto; lint sin errores, 40 warnings | Salida de build/lint |
| 2026-11-08 | WEB | 40 specs Playwright ejecutados por tandas | Flujos verificados salvo dos fallos de actualización de tablas; repeticiones de pruebas corregidas no se cuentan como casos únicos | BUG-015; reportes y trazas de Playwright |
| 2026-11-08 | WEB | Subáreas y permisos | 4/4 | `subareas.spec.ts` |
