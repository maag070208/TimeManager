# Plan de paridad Web → App KMP (CheckLab Android/iOS)

Objetivo: llevar **toda la funcionalidad de la web** a una app Kotlin Multiplatform + Compose
Multiplatform, con paridad funcional, permisos, multi-tenant, checada web con GPS y operación offline
donde aporte valor. Este documento es el plan de ejecución; no se implementa todo de golpe.

## 0. Estado actual del proyecto `checklab/`

- Proyecto KMP generado por plantilla: `androidApp`, `iosApp`, `shared`.
- Sólo existe una pantalla demo (`Greeting`, botón, imagen). **No hay** navegación, red, DI, tema,
  autenticación, modelos, almacenamiento ni pruebas de producto.
- Stack actual: Kotlin 2.4.21, Compose Multiplatform 1.12.2, Android minSdk 24, targets Android +
  iOS arm64/simulatorArm64.
- El API de CheckLab ya es la fuente de verdad: la app debe consumirlo, no duplicar reglas de negocio.

## 1. Principios

1. **API-first**: la app usa los mismos endpoints y permisos que la web. Nada de lógica de negocio
   duplicada en el cliente.
2. **Un solo núcleo compartido**: modelos, DTOs, validaciones, fechas/zona horaria, reglas de
   presentación, casos de uso y clientes HTTP viven en `commonMain`.
3. **UI Compose compartida** para la mayoría de pantallas; sólo se baja a nativo lo que lo requiere.
4. **Feature flags por rol**: la app se adapta al mismo RBAC/ABAC del API; no esconde seguridad en UI.
5. **Offline útil, no total**: checada web y consultas propias funcionan sin red con cola idempotente;
   administración requiere conexión.
6. **Entrega por fases**: cada fase es una versión instalable y verificable, no una big bang.

## 2. Arquitectura propuesta

```text
checklab/
  shared/
    commonMain/
      core/            red (Ktor), serialización, errores, reloj, timezone, validaciones
      auth/            login, sesión, refresh, tenant context, force-password
      data/            repositorios por módulo (employees, schedules, timeclock, nom, payroll…)
      domain/          casos de uso y modelos de negocio compartidos
      design/          tema CheckLab, colores, tipografía, componentes bento, iconografía
      navigation/      rutas y guards por permiso
      feature/         pantallas/feature modules (Compose)
      platform/        expect: secure storage, geolocation, maps, files, camera, push, biometrics
    androidMain/       actuals Android + Compose Android
    iosMain/           actuals iOS + Compose iOS
  androidApp/          entrypoint Android
  iosApp/              entrypoint SwiftUI + ComposeUIViewController
```

### Librerías objetivo

- **Red**: Ktor Client (`core`, `content-negotiation`, `serialization-json`, engines `okhttp`/`darwin`).
- **Serialización**: kotlinx.serialization.
- **DI**: Koin.
- **Navegación**: Compose Multiplatform Navigation (o Decompose si se necesita ciclo de vida fino).
- **Persistencia/offline**: SQLDelight (cola de checadas, caché de catálogos y sesión offline).
- **Seguridad**: Android Keystore/EncryptedSharedPreferences; iOS Keychain.
- **Fechas/TZ**: kotlinx-datetime; misma zona del tenant que la web.
- **Mapas**: Google Maps Compose (Android) / Google Maps SDK (iOS) vía `expect/actual`; fallback
  estático/OSM si no hay key.
- **Ubicación**: FusedLocationProvider (Android) / CoreLocation (iOS), sólo al checar.
- **Archivos/cámara**: Photo Picker Android / PHPicker + cámara nativa.
- **PDF/QR**: visor PDF nativo y generación/lectura QR (credencial, documentos, actas).
- **Notificaciones**: FCM + APNs; la bandeja sigue usando `/notifications`.
- **Pruebas**: kotlin.test, Turbine, Compose UI Test, Maestro/Appium para flujos E2E y golden screenshots.

### Decisiones que hay que cerrar antes de Fase 1

- [ ] ¿La app es para **personal** (checada/portal) o también para **RH/admin**? El plan asume paridad
  total por fases, pero conviene decidir qué pantallas serán “tablet/administrativo” y cuáles móvil.
- [ ] ¿Login por **código de empresa** (slug) o QR/dominio? Propuesta: código + recordar último tenant.
- [ ] ¿Push FCM/APNs desde el API o Ably? Propuesta: FCM/APNs para push y `/notifications` para bandeja.
- [ ] ¿Mapas con una key por plataforma? La key web no sirve para Android/iOS restringidas por app.
- [ ] ¿La app requiere offline de checada? Propuesta: sí, cola cifrada idempotente.
- [ ] ¿Se publica en Play Store/App Store o distribución interna? Impacta firma, review y privacidad.

## 3. Identidad visual, iconos y splash (assets oficiales)

La app debe usar el paquete oficial **`brand/CheckLab-brand-package`**, no recuperar iconos de la
plantilla ni dibujar la marca de nuevo.

| Asset oficial | Uso en la app |
|---|---|
| `svg/checklab-logo-for-dark-bg.svg` / `for-light-bg.svg` | Wordmark en login, splash y cabeceras |
| `svg/checklab-symbol-*.svg` | Símbolo compacto en top bars, avatares de tenant y estados |
| `web/png/checklab-icon-512.png` / `checklab-icon-1024.png` | Icono base Android/Play Store |
| `android/play-store/ic_launcher-512.png` + `feature-graphic-1024x500.png` | Ficha de Play Store |
| `android` adaptive icon | Foreground: símbolo CheckLab; background: navy `#1D2636` |
| `ios/AppIcon.appiconset/*` | App icon iOS (normal, dark y tinted) con su `Contents.json` |
| `lottie/checklab-logo-intro-for-dark-bg.json` | Animación de marca en splash/login oscuro |
| `lottie/checklab-logo-intro-for-light-bg.json` | Variante clara |
| `lottie/checklab-icon-intro.json` | Intro del icono en el arranque |
| `lottie/checklab-checkin-for-*.json` / `checkout` | Confirmación animada después de checar |
| `lottie/checklab-loader-for-*.json` | Procesos de checada/sincronización, no skeletons de páginas completas |

Reglas:

- **Iconos de app**: reemplazar los mipmaps de plantilla de `androidApp` por densidades desde
  `checklab-icon-512/1024`; en iOS copiar el `AppIcon.appiconset` oficial.
- **Splash Android 12+**: usar `SplashScreen` API con fondo navy e icono oficial; después montar la
  animación Lottie `checklab-icon-intro` una sola vez y saltar a login/home.
- **Splash iOS**: Launch Screen estática con fondo navy + símbolo; después animar
  `checklab-logo-intro-for-dark-bg` en la primera pantalla.
- **Lottie en KMP**: no hay Lottie oficial en Compose Multiplatform; usar `lottie-compose` en Android y
  `lottie-ios`/SwiftUI (o un wrapper `expect/actual`) en iOS. Los JSON viven en
  `shared/src/commonMain/composeResources/files/lottie/`.
- **Tema**: navy `#1D2636`, mint `#34D399`, texto mint `#0E9F6E`, amber `#F59E0B`, paper `#F4F6FA`.
- **No** usar animaciones Lottie como spinner de carga de cada pantalla; para carga usar skeletons y
  para checada/splash usar las animaciones de marca.
- Respetar `prefers-reduced-motion`/reduce motion: si está activo, mostrar el frame final estático.
- Probar iconos en Android adaptive/maskable y en iOS light/dark/tinted antes de release.

### Tareas de assets para Fase 0

1. Copiar iconos oficiales Android/iOS y reemplazar los de plantilla.
2. Configurar splash Android 12+ e iOS launch screen con navy + símbolo.
3. Integrar Lottie Android/iOS con `expect/actual` y las animaciones de logo/checkin.
4. Crear `BrandTokens` compartido (colores, tipografía, radios, spacing) desde la marca.
5. Screenshot test de launcher, splash y login en Android/iOS.

## 3. Fases

### Fase 0 — Fundaciones (1–2 semanas)

Objetivo: un esqueleto instalable con login real y navegación base.

- Limpiar plantilla demo.
- Configurar Ktor, kotlinx.serialization, Koin, navegación, tema CheckLab y recursos de marca.
- `expect/actual` de secure storage, timezone, conectividad y geolocalización.
- Cliente HTTP con base URL por build type, interceptor JWT, refresh, tenant header y manejo de 401/403.
- Login: plataforma con código de empresa, login tenant, branding, force-password, cuenta desactivada.
- Sesión persistente + logout + guard de rutas por permiso.
- Home del cliente con KPIs resumidos (los mismos widgets que la web).
- CI: Gradle build/test Android, build iOS simulator, lint/Detekt, screenshots base.

**Criterio de aceptación:** un usuario `acme.admin`/`acme.staff` entra, ve su home, cierra sesión y
las rutas protegidas no se abren sin permiso.

### Fase 1 — Portal del trabajador (2–3 semanas)

Es la fase de mayor valor móvil y la que justifica la app.

- **Mi jornada** con tabs: Mi checada / Teletrabajo / Registro y horas extra / Vacaciones.
- Checada web: entrada → salida a comer → regreso → salida; hora del servidor; modalidad/nota.
- **GPS por marcaje**: solicitar permiso, capturar lat/lng/precisión, guardar sólo con el marcaje.
- **Mapa de la checada** (Google Maps; fallback si no hay key/permiso).
- **Cola offline** de checadas con `clientEventId`, reintento y reconciliación; nunca duplicar.
- Mis marcajes por rango, origen reloj/access/remoto, reportar discrepancia con motivo ≥5.
- Teletrabajo: política, aviso de privacidad, consentimiento, checklist inicial/periódico.
- Registro electrónico: método de registro, conformidad semanal, discrepancia.
- Solicitudes de trabajo fuera de jornada: aceptar/rechazar.
- Vacaciones/permisos: saldo, solicitar, cancelar.
- Push de recordatorio de checada y de decisiones de RH.

**Criterio:** un trabajador sin reloj puede checar desde el teléfono con GPS, ver su mapa y su
historial, incluso si pierde red durante el marcaje (se encola y sincroniza).

### Fase 2 — Asistencia y jefaturas (3 semanas)

- Mi asistencia / reporte semanal propio.
- Aprobaciones móviles: tiempo extra, vacaciones/permisos, solicitudes de RH.
- Notificaciones: bandeja, filtros, marcar leído, borrar, navegación al detalle.
- Perfil de la persona: datos, foto, cambio de contraseña, credencial QR.
- Búsqueda de personas y expediente en modo lectura para RH.

**Criterio:** RH/jefe puede aprobar HE y permisos desde el teléfono y el trabajador ve el estado.

### Fase 3 — Personal, expedientes y organización (3–4 semanas)

- Personal: lista con búsqueda/filtros, alta, edición, baja/reactivación, importar (archivo).
- Expediente: tabs Actividad / Documentos / Reloj / Datos.
- Documentos: cámara/archivo, subir, ver, descargar, eliminar, faltantes obligatorios.
- Actas administrativas: lista, alta, detalle, PDF, eliminar.
- Departamentos, subáreas, catálogos de documentos.
- Convenios y acuerdos; firma del trabajador/patrón cuando aplique.
- Vacaciones/permisos del lado RH.

**Criterio:** RH puede gestionar el expediente de una persona desde el teléfono/tablet, con documentos
reales (S3) y permisos coherentes.

### Fase 4 — Horarios y tiempo extra (3 semanas)

- Horarios: lista, alta/edición de 7 días, descansos, turno nocturno, validación legal, activar/desactivar.
- Asignación en dos columnas con flechas y aviso de reemplazo actual→nuevo.
- Tiempo extra: aprobación diaria, rechazo con motivo, filtros por periodo/estatus.
- Clasificación semanal LFT: dobles/triples/excedente, confirmar semana.
- Exportaciones PDF/CSV cuando el backend lo permita.

**Criterio:** se crea un horario legal, se asigna a una persona reemplazando el anterior y se aprueba
HE desde la app.

### Fase 5 — Pre-nómina y puestos (3–4 semanas)

- Pre-nómina: semana/departamento, KPIs, costo de plantilla, sueldo diario, resumen/detallado.
- Verificar por departamento, marcar todo, cerrar semana con confirmación y snapshot, reabrir.
- Historial de cierres.
- Puestos de nómina: CRUD, salario/SBC, activar/desactivar (desasigna personal), asignar personal.
- Configuración de nómina: salario/jornada, HE, prestaciones, ISR/IMSS, calcular recibo.

**Criterio:** RH cierra una semana completa con snapshot y reabre; el costo y los salarios se ven
correctos.

### Fase 6 — Relojes y checadas administrativas (3 semanas)

- Dashboard del reloj: estado, alertas, tabs Estado/Personas/Eventos/Cámara/Lector/Relojes.
- Relojes: alta/edición/baja, probar conexión, sincronizar, historial, agente local.
- Personas del reloj: padrón, vinculación, tarjetas, renombrar, baja.
- Roster: correr padrón, bajas con motivo, descartar.
- Diferencias reloj↔sistema y conciliación.
- Lector de huella/cámara: nativo si hay SDK; si no, modo lectura/estado.
- Reporte Entradas/Salidas con exportación.

**Criterio:** un admin puede diagnosticar un reloj, vincular personas y corregir el padrón desde la app.

### Fase 7 — Configuración, roles y auditoría (3 semanas)

- Configuración general por tabs (Operación/Asistencia/Límites/Checada web).
- Catálogos: permisos, documentos, departamentos, puestos.
- Roles/permisos: lista, matriz, acceso por persona, excepciones, políticas, actividad.
- Auditoría: filtros, detalle inmutable.
- Notificaciones y preferencias.
- Multi-cliente para ADMIN/SUPPORT: consola de clientes, planes, agentes, impersonación.
- Plataforma: tenants, plan, pagos, módulos, actividad.

**Criterio:** la app permite operar el tenant completo y auditar sin volver a la web.

### Fase 8 — Endurecimiento y release (2–3 semanas)

- Offline avanzado, reintentos, conflicto de secuencia, migraciones SQLDelight.
- Biometría para desbloqueo local; bloqueo por inactividad.
- Accesibilidad, tamaños de texto, contraste, landscape/tablet.
- Performance, consumo de batería y red; imágenes optimizadas.
- Privacidad: ubicación solo en checada, consentimiento, retención local, logs sin PII.
- Firma, Play Console/App Store, TestFlight, crash reporting, analítica mínima.
- Runbook de release y feature flags.

## 4. Matriz de pantallas Web → App

| Módulo Web | Pantallas | Fase |
|---|---|---|
| Auth | Login tenant/plataforma, force-password, cliente inválido | 0 |
| Inicio | Home cliente / plataforma | 0–7 |
| Mi jornada | Checada, marcajes, discrepancia, teletrabajo, HE, registro, vacaciones | 1 |
| Asistencia | Reporte semanal, entradas/salidas, roster, empleados del reloj, diferencias | 2, 6 |
| Personal | Lista, alta, edición, historial, cuenta, expediente | 3 |
| Documentos | Catálogo, expediente, actas | 3 |
| Organización | Departamentos, subáreas | 3 |
| Horarios | Lista, alta/edición 7 días, asignar | 4 |
| Tiempo extra | Aprobación diaria/semanal | 4 |
| Pre-nómina | Reporte, historial, puestos, configuración | 5 |
| Relojes | Dashboard, personas, inspect, relojes, agente | 6 |
| Configuración | General, catálogos | 7 |
| Roles | Roles, matriz, acceso, políticas, catálogo, actividad | 7 |
| Auditoría | Bitácora y detalle | 7 |
| Plataforma | Clientes, planes, pagos, agentes, impersonación | 7 |
| Notificaciones | Bandeja y filtros | 2 |
| Landing | No aplica (web pública) | — |

## 5. Reglas de negocio que deben compartirse

- Una sola asignación vigente por persona; aviso de reemplazo.
- Horario de 7 días, descanso obligatorio y topes LFT.
- Checada web con GPS: coordenadas por marcaje, sin rastreo continuo.
- Modo de checada WEB/CLOCK/HYBRID.
- HE dobles/triples/excedente; confirmación semanal.
- Cierre de pre-nómina con snapshot y reapertura.
- Permisos RBAC/ABAC idénticos al API; el cliente nunca decide autorización final.
- Auditoría inmutable: la app no edita ni borra registros.

## 6. Offline y sincronización

- SQLDelight con tablas: `pending_punches`, `cached_notifications`, `cached_catalogs`, `session`.
- Cada checada offline lleva `clientEventId` (UUID) para idempotencia del API.
- Reintento con backoff; conflicto de secuencia (409) se muestra al usuario y se reconcilia.
- La ubicación se captura al momento y se guarda junto al marcaje; nunca se rastrea en background.
- La cola se cifra localmente; logout limpia datos sensibles según política.

## 7. Pruebas y calidad

- **Unit common**: validaciones, fechas/TZ, secuencia de checada, permisos, cola offline.
- **Contrato API**: mismos DTOs que la web; tests con Ktor MockEngine y fixtures compartidos.
- **Compose UI tests** por flujo (login, checada, aprobación, horario).
- **E2E**: Maestro (Android/iOS) o Appium con el API E2E existente; reutilizar `tm_e2e`.
- **Golden screenshots** Android/iOS por pantalla clave.
- **Accesibilidad**: TalkBack/VoiceOver, tamaños, contraste.
- **CI**: build Android, build iOS simulator, unit tests, lint/Detekt, screenshots; release manual.

## 8. Estimación

Con **1 dev KMP + 1 diseñador/QA parcial**:

| Fase | Semanas |
|---|---:|
| 0 Fundaciones | 1–2 |
| 1 Portal del trabajador | 2–3 |
| 2 Asistencia/jefaturas | 3 |
| 3 Personal/expedientes | 3–4 |
| 4 Horarios/HE | 3 |
| 5 Pre-nómina/puestos | 3–4 |
| 6 Relojes | 3 |
| 7 Configuración/roles/plataforma | 3 |
| 8 Endurecimiento/release | 2–3 |
| **Total** | **23–28 semanas** |

No es un port de UI: es un producto móvil con offline, permisos, mapas, cámara, archivos y release.

## 9. Primer sprint concreto (empezar aquí)

1. Limpiar la plantilla y crear módulos `core`, `design`, `auth`, `home`.
2. Añadir Ktor + serialización + Koin + navegación.
3. Definir tema CheckLab y componentes base (botón, campo, card, KPI, tabs, empty/loading/error).
4. Implementar login tenant/plataforma contra `POST /auth/login` y `GET /auth/branding`.
5. Guardar sesión en Keychain/Keystore, refresh y logout.
6. Home con KPIs reales del cliente.
7. Tests: login OK/erróneo, persistencia de sesión, guard de ruta.
8. APK instalable + build iOS simulator.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Pantallas administrativas muy densas en móvil | Diseño tablet-first para Fases 4–7; no copiar tablas 1:1 |
| Diferencias de zona horaria | Usar TZ del tenant y utilidades compartidas, tests de borde |
| GPS denegado o impreciso | Checada sin GPS permitida si la política lo permite; mostrar precisión |
| API keys de mapas | Keys separadas Android/iOS con restricciones de package/bundle |
| Offline duplicando checadas | `clientEventId` + reconciliación 409 + pruebas de reintento |
| iOS build/signing | CI macOS + TestFlight desde Fase 0; no dejarlo al final |
| Push FCM/APNs | Configurar desde Fase 1; bandeja API como respaldo |
| Alcance “todo de golpe” | Fases cerradas con criterios de aceptación y demo instalable |

## 11. Decisiones abiertas

- [ ] ¿App para todo el mundo o sólo personal + jefaturas en v1?
- [ ] ¿Se permite checada sin GPS? ¿Obligatorio en clientes sin reloj?
- [ ] ¿Mapas Google o alternativa sin key?
- [ ] ¿Distribución pública o enterprise?
- [ ] ¿Se reutiliza Ably o se migra a FCM/APNs?
- [ ] ¿Qué pantallas quedan tablet-only?
