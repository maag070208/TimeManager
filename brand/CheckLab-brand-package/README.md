# Checklab – paquete de marca

Símbolo: credencial de empleado con sello de asistencia registrada.
Colores: azul marino #1D2636 · blanco #F4F6FA · menta #34D399 (sobre fondo claro #0E9F6E) · ámbar #F59E0B (salida)
Tipografía del wordmark: Inter Bold + Inter Regular (convertida a trazados en los SVG).

## Contenido
- `svg/`      Logos e iconos vectoriales (color, negro, blanco; para fondo claro y oscuro).
- `web/`      favicon (svg/ico/png), apple-touch-icon, iconos PWA (192/512/maskable), og-image 1200x630,
              site.webmanifest y `head-snippet.html` listo para pegar en <head>. Logos PNG en `web/png/`.
- `android/`  `res/` listo para copiar a `app/src/main/res/` (adaptativo + monocromo Android 13, legacy, redondo,
              ícono de notificación) y `play-store/` (ícono 512 y feature graphic 1024x500).
- `ios/`      `AppIcon.appiconset` (1024 claro/oscuro/tinted, Xcode 15+) y `legacy-sizes/` con todos los tamaños.
- `lottie/`   Animaciones .json:
    - checklab-icon-intro.json                     ícono sobre fondo azul que se dibuja (4 s)
    - checklab-logo-intro-for-dark-bg / -for-light-bg   logo completo con fondo transparente (4.6 s)
    - checklab-loader-for-dark-bg / -for-light-bg       loader en loop (1.5 s): aro girando junto a la credencial
    - checklab-checkin-for-dark-bg / -for-light-bg      ENTRADA: la credencial entra y se confirma con palomita (3 s)
    - checklab-checkout-for-dark-bg / -for-light-bg     SALIDA: sello ámbar con flecha y la credencial sale (3 s)

## Uso rápido
- Android: copia `android/res/*` en `app/src/main/res/` y usa `@mipmap/ic_launcher` en el manifest.
- iOS: arrastra `AppIcon.appiconset` a Assets.xcassets.
- Lottie: lottie-web, lottie-react, lottie-android (airbnb) o lottie-ios.
