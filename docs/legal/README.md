# Documentos legales de CheckLab

Revisión del 18-nov-2026. **Antes de esta revisión el producto no tenía términos de uso ni aviso de privacidad propios**: ni en la landing, ni en el login, ni en la app móvil. Solo existía, en Teletrabajo, un campo para que cada cliente escriba su propio aviso para el personal en teletrabajo.

Todos los textos de esta carpeta son **borradores para revisión legal**. No se publican hasta que un abogado los valide y se llenen los datos marcados con `[corchetes]`.

| Documento | Quién lo emite | Para quién |
|---|---|---|
| [`terminos-de-servicio.md`](terminos-de-servicio.md) | CheckLab | Empresas cliente |
| [`acuerdo-tratamiento-de-datos.md`](acuerdo-tratamiento-de-datos.md) | CheckLab (encargado) y cliente (responsable) | Empresas cliente; anexo de los términos |
| [`aviso-de-privacidad.md`](aviso-de-privacidad.md) | CheckLab (responsable) | Administradores, contactos de clientes y visitantes del sitio |
| [`plantilla-aviso-trabajadores.md`](plantilla-aviso-trabajadores.md) | Cada cliente (responsable) | Su personal: biometría, ubicación, registro de jornada |

Marco: Ley Federal de Protección de Datos Personales en Posesión de los Particulares (nueva ley, DOF 20-mar-2025; la autoridad es la Secretaría Anticorrupción y Buen Gobierno, ya no el INAI), Ley Federal del Trabajo y NOM-037-STPS-2023. Ver también [`../NOM_CUMPLIMIENTO.md`](../NOM_CUMPLIMIENTO.md) y, para los acuerdos de jornada con el personal (método de registro y convenio de distribución), [`../LEGAL_REVISION_ACUERDOS.md`](../LEGAL_REVISION_ACUERDOS.md).

## Datos que faltan para completarlos

- Razón social, RFC y domicilio de quien opera CheckLab.
- Correo y teléfono de privacidad y de contacto comercial.
- Dominio de producción y URLs donde se publicarán (`/terminos`, `/privacidad`).
- Proveedores reales y región de sus servidores: alojamiento, archivos, correo y pagos.
- Decisiones de negocio: periodicidad de cobro, días de gracia, reembolsos, disponibilidad comprometida, tope de responsabilidad y ciudad de jurisdicción.
- Plazos: conservación de datos fiscales y de registro de jornada (validar con asesor laboral).

## Huecos en el producto (no son texto, son funciones)

1. **No hay dónde leerlos.** Faltan las páginas públicas de términos y aviso de privacidad, y sus enlaces en la landing, el login y la app móvil. Las tiendas de apps (Google Play y App Store) exigen la URL de la política de privacidad para publicar la app.
2. **El cliente no acepta los términos al darse de alta.** El alta de clientes no registra la aceptación de los términos ni del acuerdo de datos (versión, fecha y quién aceptó).
3. **El personal que checa en reloj con huella o rostro nunca ve un aviso de privacidad.** Hoy el aviso del cliente y su aceptación versionada solo se muestran en Mi jornada a quien está registrado en teletrabajo. La biometría y la ubicación requieren consentimiento expreso de todo el personal que las use, no solo del que está en teletrabajo.
4. **No hay plantilla en el sistema.** El campo del aviso del cliente empieza vacío; convendría precargar `plantilla-aviso-trabajadores.md` para que RH solo llene sus datos.
