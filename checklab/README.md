# CheckLab — app móvil (Kotlin Multiplatform)

App Android/iOS con Compose Multiplatform que consume el mismo API que la web. Plan por fases:
[docs/PLAN_PARIDAD_WEB_APP.md](docs/PLAN_PARIDAD_WEB_APP.md).

**Decisión de producto:** la app es el producto del cliente (personal, RH y administradores); la
web queda para el equipo de CheckLab. El login siempre pide el código de empresa.

## Estado: Fases 0–7 en la app · Fase 8 (endurecimiento) parcial

Todas las secciones del menú del cliente ya tienen pantalla; el drawer muestra solo lo que el rol
permite (mismos permisos que la web) y cada ruta vuelve a validar el permiso.

| Paquete (`shared/commonMain`) | Pantallas |
|---|---|
| `nom/` | Mi checada (GPS puntual, cola offline cifrada con `clientEventId`), mis marcajes, discrepancias; Mi jornada: teletrabajo, constancia y horas extra, vacaciones y permisos |
| `approvals/` | Notificaciones, aprobación de tiempo extra, decisión de vacaciones y permisos |
| `people/` | Personal (alta, baja, reactivar, ficha), expedientes, departamentos, actas administrativas |
| `schedules/` | Horarios (editor semanal) y asignación |
| `payroll/` | Pre-nómina semanal por departamento, cierre y reapertura, historial, puestos de nómina |
| `clocks/` | Relojes (conexión, checadas de hoy, alertas, sincronizar, padrón) y rejilla semanal de asistencias |
| `settings/` | Configuración del sistema (`/nom/config`), convenios de jornada (consulta y alta), teletrabajo NOM-037, roles (consulta), auditoría |
| `auth/` | Login, cambio de contraseña y Mi perfil con la credencial y su QR (mismo JSON v2 que la web, librería [qrose](https://github.com/alexzhirkevich/qrose)) |

Pantalla de arranque navy nativa en Android (`Theme.CheckLab`) e iOS (`UILaunchScreen` +
`LaunchBackground`), seguida del splash de Compose.

CI: los jobs `app-android` (pruebas + APK debug) y `app-ios` (pruebas en simulador) de
`.github/workflows/ci.yml`.

Pendiente: mapa nativo (hoy abre el mapa externo), push FCM/APNs, subida de documentos al
expediente, edición de permisos por rol (sigue en la web), Lottie en el splash, traducción al
inglés y screenshot tests.

### Fase 0

- `shared/commonMain`: `core/network` (Ktor, JSON, token Bearer y refresh con un reintento tras 401),
  `core/storage` (`SecureStore`), `auth` (login en dos pasos por código de empresa, sesión, contraseña
  provisional, guard `destinationFor`), `home` (widgets `/dashboard/*` según permiso), `design` (tema de
  marca y componentes base), `navigation` y `di` (Koin).
- `androidMain`: Keystore (AES-GCM). `iosMain`: Keychain.
- Iconos oficiales de `brand/CheckLab-brand-package` en Android (adaptativo) e iOS (`AppIcon`).
- Login con el diseño de la web (panel navy, hoja blanca, campos píldora) e iconos Lucide nativos
  (`design/LucideIcons.kt`, generado con `node checklab/scripts/gen-lucide.mjs`).
- **Blobatar para KMP** (`design/blobatar/`): port del núcleo de [blobatar](https://github.com/Alain00/blobatar)
  2.7.0 (MIT). Mismo nombre → misma figura que en la web; `BlobatarParityTest` compara contra SVG
  generados con la librería JS. `BlobatarImage(name)` la dibuja en un Canvas, sin imágenes.

## Correr contra el API local

El API demo corre en el puerto 4021 (`.claude/launch.json`, `api-demo`).

- **Android emulador**: `./gradlew :androidApp:assembleDebug` (usa `http://10.0.2.2:4021/api/v1`).
  Teléfono físico: `-Pchecklab.apiUrl=http://<host-de-la-mac>.local:4021/api/v1`.
- **iOS simulador**: Xcode con `iosApp`; `Config.xcconfig` apunta a `localhost`.
- **iPhone físico**: la URL va en `CHECKLAB_API_URL` (xcconfig o línea de comandos):

```bash
xcodebuild -project iosApp/iosApp.xcodeproj -scheme iosApp -configuration Debug \
  -destination "id=<UDID>" -derivedDataPath build/ios-device -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<team> "CHECKLAB_API_URL=http://<host-de-la-mac>.local:4021/api/v1" build
xcrun devicectl device install app --device <UDID> build/ios-device/Build/Products/Debug-iphoneos/checklab.app
```

Release Android exige `-Pchecklab.releaseApiUrl=...` (el dominio de producción sigue pendiente).

## Pruebas

- `./gradlew :shared:testAndroidHostTest` y `./gradlew :shared:iosSimulatorArm64Test`
  (sesión, refresh, guard, permisos, zona horaria; `MockEngine`, sin red).

### Running the apps

Use the run configurations provided by the run widget in your IDE's toolbar. You can also use these commands and
options:

- Android app: `./gradlew :androidApp:assembleDebug`
- iOS app: open the [/iosApp](./iosApp) directory in Xcode and run it from there.

### Running tests

Use the run button in your IDE's editor gutter, or run tests using Gradle tasks:

- Android tests: `./gradlew :shared:testAndroidHostTest`
- iOS tests: `./gradlew :shared:iosSimulatorArm64Test`

---

Learn more about [Kotlin Multiplatform](https://www.jetbrains.com/help/kotlin-multiplatform-dev/get-started.html)…
## Plan de producto

- [Paridad Web → App KMP](docs/PLAN_PARIDAD_WEB_APP.md)
