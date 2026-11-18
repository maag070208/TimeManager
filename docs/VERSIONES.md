# Versiones de CheckLab

CheckLab tiene **una sola versión** para el API, la web y la app móvil, con formato `MAYOR.MENOR.PARCHE` (semver). Versión actual: ver `pnpm version:show`.

## Dónde se ve

| Parte | Dónde |
|---|---|
| API | `GET /api/v1/health` → `version` y `commit` (público). Cada error técnico del log trae también la versión del cliente que hizo la petición (`X-Client-Version`) |
| Web | Pie del login (`v1.0.0 · <commit>`) y menú de la persona › **Acerca de CheckLab**, que muestra la web y el servidor y avisa si su versión MENOR no coincide |
| App | Pie del login y **Mi perfil › Acerca de CheckLab** (app con su build y servidor) |

El commit sale de `RAILWAY_GIT_COMMIT_SHA` en Railway (o `GIT_COMMIT`) y, en local, de git. Así dos despliegues con la misma versión se distinguen.

## Cómo se sube

```bash
pnpm version:set 1.1.0
```

Escribe la versión en `package.json`, `api/package.json`, `web/package.json`, `checklab/gradle.properties` (`checklab.version`, `checklab.versionCode`) y `checklab/iosApp/Configuration/Config.xcconfig` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`). Luego se commitea y, si es un release, se etiqueta: `git tag v1.1.0`.

El número de build de las tiendas se deriva de la versión: `MAYOR*10000 + MENOR*100 + PARCHE` (1.1.0 → 10100). Siempre crece al subir la versión, que es lo que exigen Google Play y App Store. MENOR y PARCHE van de 0 a 99.

`pnpm version:check` falla si alguna parte quedó con otra versión; corre en CI (job *quality*).

## Cuándo subir cuál

- **PARCHE** (1.0.0 → 1.0.1): correcciones que no cambian lo que el API recibe o devuelve.
- **MENOR** (1.0.0 → 1.1.0): funciones nuevas o cambios del API que la web o la app necesitan. La web avisa cuando su MENOR no coincide con la del API.
- **MAYOR** (1.x → 2.0.0): cambios que rompen versiones anteriores de la app móvil (las que la gente aún no actualiza).
