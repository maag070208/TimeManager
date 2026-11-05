# TimeManager – paquete de marca

Colores: azul marino #1D2636 · blanco #F4F6FA · ámbar #F2A93B (sobre fondo claro #E8920F)
Tipografía del wordmark: Inter Bold + Inter Regular (ya convertida a trazados en los SVG).

## Contenido
- `svg/`      Logos e iconos vectoriales (color, negro, blanco; para fondo claro y oscuro).
- `web/`      favicon (svg/ico/png), apple-touch-icon, iconos PWA (192/512/maskable), og-image 1200x630,
              site.webmanifest y `head-snippet.html` listo para pegar en <head>. Logos PNG en `web/png/`.
- `android/`  `res/` listo para copiar a `app/src/main/res/` (ícono adaptativo + monocromo Android 13,
              legacy, redondo, ícono de notificación) y `play-store/` (ícono 512 y feature graphic 1024x500).
- `ios/`      `AppIcon.appiconset` (1024 claro / oscuro / tinted, Xcode 15+) y
              `legacy-sizes/AppIcon.appiconset` con todos los tamaños para versiones anteriores.
- `lottie/`   Animaciones .json:
    - timemanager-icon-intro.json            ícono sobre fondo azul que se dibuja (4 s, sin loop)
    - timemanager-logo-intro-for-dark-bg.json / -for-light-bg.json   logo completo, fondo transparente (4.6 s)
    - timemanager-loader-for-dark-bg.json / -for-light-bg.json       loader en loop (2 s)

## Uso rápido
- Android: copia `android/res/*` dentro de `app/src/main/res/` y usa `@mipmap/ic_launcher` en el manifest.
- iOS: arrastra `AppIcon.appiconset` a Assets.xcassets.
- Lottie: lottie-web, lottie-react, lottie-android (airbnb) o lottie-ios.
