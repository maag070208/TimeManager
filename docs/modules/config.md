# config — Configuración del sistema

Clave-valor de configuración (`SysConfig`) con bitácora de quién la modificó. Hoy alimenta, entre otras cosas, la configuración de correo y el idioma del sistema.

## Endpoints

`GET /`, `GET /:key`, `PUT /:key` (upsert), `DELETE /:key`.

## Modelos

`SysConfig`.

## Permisos

`system.configure` para escribir; lectura por clave con sesión.

## Dependencias

`core/services/mail` y `core/i18n` leen de aquí (`setSysConfigService`, `LANGUAGE_CONFIG_KEY`).

## Notas multi-tenant

- Separar en dos niveles: **config de plataforma** (global: idioma default, límites de planes) y **config por tenant** (zona horaria, reglas de jornada, plantillas de correo, aviso de privacidad).
- Zona horaria por tenant es crítica: las checadas y los cortes de día dependen de ella. Hoy todo asume la zona del servidor.
- Los secretos (SMTP, claves) no deben vivir aquí en texto plano: vault o variables de entorno por tenant.
