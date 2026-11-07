# Plan — Landing pública de CheckLab

Basado en el recorrido del sistema con los datos demo (`pnpm demo:seed`): 67 capturas de 8 sesiones (administrador, RH, personal y teletrabajo de tres empresas, más la consola de plataforma). Galería local en `capturas/index.html` (no versionada); se regenera con `web/scripts/capture-screens.mjs`.

## 1. Qué vende el sistema (lo que se vio en pantalla)

Las pantallas que mejor demuestran el producto, en orden de impacto:

| # | Pantalla | Ruta | Qué demuestra |
|---|---|---|---|
| 1 | Inicio del cliente | `/` | "11 / 30 en sitio", a tiempo / retardo / sin llegar, expedientes, extra de la semana: el día de un vistazo |
| 2 | Asistencias (semana) | `/hr/time-clock/entries-exits` | Rejilla semanal por persona con estado (en sitio, falta, turno cerrado) e incidencias |
| 3 | Tiempo extra LFT | `/schedules/overtime/approval` | Horas ordinarias, dobles, triples y excedente ilegal por semana; aprobación |
| 4 | Pre-nómina | `/schedules/payroll` | Revisión por departamento, costo de plantilla, faltas, cierre de semana |
| 5 | Historial de cierres | `/schedules/payroll/history` | Semanas cerradas con quién/cuándo y cifras |
| 6 | Mi jornada (móvil) | `/mi-jornada` | Marcaje web, siguiente paso, historial de marcajes |
| 7 | Teletrabajo NOM-037 | `/teletrabajo` | Política, desconexión, aviso de privacidad, checklists |
| 8 | Expedientes | `/employees/records` | Avance por persona, obligatorios, aviso a pendientes |
| 9 | Vacaciones y permisos | `/hr/leave` | Bandeja de aprobación con contexto |
| 10 | Convenios y acuerdos | `/hr/jornada-acuerdos` | Convenio art. 58 y acuerdo del método de registro firmados |
| 11 | Consola de plataforma | `/` (ADMIN) y `/tenants/:id` | Clientes, ingreso mensual, kardex de cobros, módulos por cliente |
| 12 | Relojes | `/time-clocks` | Relojes por sucursal, checadas guardadas, agente local |

## 2. Hallazgos del sistema que bloquean o afectan la landing

Se arreglan **antes** de tomar las capturas de marketing (si no, la landing mostraría errores o cifras equivocadas):

1. **CSS: capas en orden incorrecto (toda la app).** `web/src/app/main.tsx` importa `@axzydev/axzy_ui_system/dist/index.css` sin capa y antes de `index.css`; eso fija el orden de capas primero y deja `axzy-ui-system` por encima de `utilities`. Resultado: los resets del design system (p. ej. `h1…h6 { font-size: inherit }`) le ganan a las clases de Tailwind. En la landing el H1 sale en 12.8 px. Arreglo: quitar el import duplicado (ya se importa con `layer(axzy-ui-system)` en `index.css`) y revisar visualmente las pantallas, porque puede cambiar tamaños que hoy "funcionan" por accidente.
2. **Horas extra infladas por la comida.** El motor semanal resta la comida de la jornada programada pero no de lo trabajado (la sesión del reloj va de la primera a la última checada). Una persona de oficina 09:00–18:00 aparece con ~80 min de extra doble diaria. Afecta "Tiempo extra" y "Pre-nómina", las pantallas 3 y 4.
3. **Turno partido cuenta el hueco como trabajado.** Con reloj, 08–13 + 16–20 da 12 h y dispara alertas de tope. El demo ya no usa turno partido, pero el bug sigue en el producto.
4. **Expediente individual cae sin almacenamiento.** `/employees/:id` y `/employees/:id/edit` muestran solo "Almacenamiento de archivos no configurado" cuando no hay S3. Debería degradar (ocultar foto/descargas) en vez de tumbar la página.
5. **Relojes demo "Sin conexión".** El worker intenta las IPs ficticias y la pantalla de relojes y checadas queda en rojo. Para capturas: correr el mock ISAPI (`api/scripts/isapi-mock`) y apuntar los relojes demo a él, o sembrarlos con la URL del mock.
6. **Pantallas del reloj en vivo se quedan cargando** sin reloj real (`/time-clocks/dashboard`, `/time-clocks/inspect`, `/time-clocks/people` vacía). No se usan en la landing.
7. **Bitácora: columna de módulo** muestra el `entityType` largo y se encima con la acción (`WorkRecordAcknowledgment`).
8. Detalles menores vistos: historial de usuario en 0 aunque hay actividad; vista previa del acta en blanco al capturar.

Los puntos 1, 2 y 5 son prerrequisito de la landing; 3, 4, 6, 7 y 8 se reportan para su propio arreglo.

## 3. Dirección de la landing

Se conserva lo que ya funciona del borrador actual (`web/src/pages/landing/`): marca CheckLab (marino, menta = entrada, ámbar = salida), estructura de bento, sección de cumplimiento oscura, planes y FAQ. Cambia el enfoque visual:

- **Producto real, no maquetas.** Las celdas principales usan recortes de pantallas reales con datos demo (nítidos, 2×, WebP). Las mini-interfaces en código se quedan solo donde la app no tiene una pantalla fotogénica: flujo reloj → agente → nube y la transición 48 → 40 h.
- **Una historia, de la checada a la nómina:** checar → ver el día → horas extra legales → cerrar la pre-nómina → probarlo ante la autoridad.
- **Sin prueba social inventada:** no hay logos de clientes ni testimonios ficticios. Las empresas demo aparecen solo dentro de las capturas, rotuladas como datos de demostración.
- **Tema claro como principal.** La app no tiene modo oscuro; las capturas son claras. El toggle oscuro se quita (o se deja solo en el marco, decisión abajo).

## 4. Estructura

1. **Navegación**: logo CheckLab, Producto · Cumplimiento · Cómo funciona · Planes · Preguntas, Iniciar sesión, Solicitar demo.
2. **Hero**: titular "Cada checada cuenta. Y se puede comprobar." + bajada + CTAs. A la derecha, composición en capas: captura del **Inicio** (pantalla 1) y, encima, el teléfono con **Mi jornada** (pantalla 6) y una tarjeta flotante "Checada registrada" con el símbolo de la credencial.
3. **Franja de giros y cifras del producto**: logística, salud, restaurantes, manufactura, retail; 0 checadas editables · 5 min de sincronización · tope 12 h · 48 → 40 h.
4. **Bento del producto** (12 columnas):
   - Grande (7): **Tiempo extra LFT** — recorte de la tabla con dobles/triples/excedente (pantalla 3).
   - (5): **Reloj y agente** — diagrama en código + recorte de tarjetas de relojes (pantalla 12).
   - (5): **Asistencia de la semana** — recorte de la rejilla con estados (pantalla 2).
   - (7): **Pre-nómina** — revisión por departamento + historial de cierres (pantallas 4 y 5).
   - (4): **Prueba plena** — línea de tiempo checada → ajuste → aprobación → export con hash (código, basado en el flujo real de ajustes).
   - (4): **Teletrabajo NOM-037** — recorte de política y checklists (pantalla 7).
   - (4): **Expedientes y permisos** — recortes de pantallas 8 y 9.
   - (6): **Multi-empresa** — recorte de la consola de plataforma (pantalla 11).
   - (6): **Reforma 40 h** — gráfica en código con la tabla real del motor (48/46/44/42/40 h y tope al doble 9/9/10/11/12 h).
5. **Recorrido "Un día con CheckLab"**: 4 pasos horizontales con captura cada uno (06:52 checa en el reloj → 09:00 RH ve quién falta → viernes aprueba extra → miércoles cierra pre-nómina).
6. **Cumplimiento** (bloque marino): lista de obligaciones cubiertas + nota de que el formato oficial depende de la STPS.
7. **Cómo funciona**: instalar reloj → conectar agente → operar.
8. **Planes**: los tres del catálogo con "desde" y nota de precios de referencia.
9. **Preguntas frecuentes**.
10. **CTA final** y pie.

## 5. Implementación

1. Arreglar prerrequisitos 1, 2 y 5 (sección 2), cada uno con su prueba.
2. **Pipeline de capturas para marketing**: extender `web/scripts/capture-screens.mjs` con un modo `--marketing` que tome solo las pantallas de la sección 1, a `deviceScaleFactor: 2`, recorte por región (selector del bloque, no coordenadas fijas), oculte el selector de cliente/nombres de usuario si se pide, y exporte WebP a `web/public/landing/`. Así las capturas se regeneran cuando cambie la UI.
3. Componente `Shot` (marco con borde, sombra, `loading="lazy"`, `width/height` explícitos para no mover el layout, `alt` descriptivo).
4. Reescribir el bento con las capturas; mantener `HeroConsole` solo si se decide conservar la consola animada en lugar de la captura del inicio.
5. Ajustar escala tipográfica de la landing en px (no depender del `font-size` 80 % del `html` de la app).
6. SEO: `<title>`, descripción y `og:image` de la landing (hoy usa los del `index.html` de la app).
7. QA: `tsc -b`, lint, revisión visual en 1440, 1024, 768 y 390 px, `prefers-reduced-motion`, contraste AA, navegación con teclado; Lighthouse (rendimiento ≥ 90 con imágenes WebP perezosas).

## 6. Decisiones abiertas

- **[ABIERTA]** ¿La landing pasa a ser la portada pública (`/` sin sesión, o dominio raíz) o se queda en `/#/landing`?
- **[ABIERTA]** CTA: ¿`mailto:` como hoy, formulario propio o liga a agenda (Calendly u otro)?
- **[ABIERTA]** Precios: ¿se publican los del catálogo ("desde $500/$750/$1,000") o "Cotiza"? (AGENTS.md: precios definitivos pendientes.)
- **[ABIERTA]** Modo oscuro: quitarlo (recomendado, las capturas son claras) o conservarlo solo para el marco.
- **[ABIERTA]** Afirmaciones legales ("cumple LFT/NOM-037"): validar redacción con el asesor antes de publicar (ver `NOM_CUMPLIMIENTO.md`).
