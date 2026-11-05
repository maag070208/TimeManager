# email — Cola y bitácora de correos

Envío de correos (Nodemailer/Resend) con bitácora (`EmailLog`), reintento y cancelación. Se usa para avisos de RH, alertas de discrepancias y reportes.

## Endpoints

`POST /mail/logs/query` (bitácora paginada), `POST /mail/logs/:id/retry`, `POST /mail/logs/:id/cancel`.
Las tres exigen sesión de plataforma (ADMIN) y `system.configure`.

## Modelos

`EmailLog`.

## Permisos

`system.configure` **y** usuario de plataforma (sin `tenantId`). La bitácora de envíos es del panel de soporte:
una excepción de permiso a un usuario de cliente no debe abrirla (defensa en profundidad F1A-12, guard
`requiresPlatform`).

## Dependencias

`core/services/mail` (cola), configuración en `config` (sys-config).

## Correos que existen

| Plantilla | Cuándo | A quién |
|---|---|---|
| `tenantWelcomeEmail` | Alta de cliente (`POST /tenants`) | Su `CLIENT_ADMIN` (si tiene correo): entrada, usuario, contraseña provisional, primeros pasos |
| `welcomeEmail` | Alta de persona | La persona (usuario, contraseña provisional y botón a su subdominio) y, en versión resumen, a los avisos de RH |
| `documentUploadedEmail` | Documento al expediente | La persona y avisos de RH |
| `userDeactivatedEmail` / `userReactivatedEmail` | Baja / reactivación | La persona y avisos de RH |
| `employeeRegistrationEmail` | Alta de personal | Avisos de RH |
| `rosterAlertEmail` | Padrón del reloj | RH |

## Marca y destinatarios

- Marca TimeManager (azul marino `#1D2636`, ámbar `#F2A93B`, ícono PNG inline `cid:timemanager-logo`); remitente `TimeManager <RESEND_FROM_EMAIL>`.
- El encabezado y algunos asuntos llevan el **nombre del cliente**: las plantillas ponen `EMAIL_COMPANY_TOKEN` y `enqueueEmail` lo reemplaza con el cliente del contexto (`tenantBrand`, cache de 60 s; se invalida al renombrar).
- Botón de entrada: `webLoginUrl(slug)` arma la URL desde la entrada con comodín de `WEB_ORIGIN` (`https://*.timemanager.mx` → `https://acme.timemanager.mx/login`).
- **Avisos de RH** (`enqueueNotificationEmail`): dentro de un cliente van a sus `CLIENT_ADMIN` y `HUMAN_RESOURCES` activos con correo; la lista global `NOTIFICATION_EMAILS` / `EMAIL_NOTIFICATION_RECIPIENTS` solo se usa en plataforma. Antes todo iba a la lista global (fuga entre clientes).
- Resend exige el dominio del remitente verificado (resend.com → Domains, registros SPF/DKIM); si no, responde 403 y el correo queda en la cola con reintentos.

## Notas multi-tenant

- El remitente y la plantilla deben poder personalizarse por tenant (marca del cliente).
- En SaaS conviene un proveedor con subcuentas o dominios verificados por cliente (Resend/SES) y aislamiento de reputación: un cliente con spam no debe quemar el dominio de todos.
- Rate limit por tenant para evitar que un cliente sature la cola de los demás.
