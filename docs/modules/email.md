# email — Cola y bitácora de correos

Envío de correos (Nodemailer/Resend) con bitácora (`EmailLog`), reintento y cancelación. Se usa para avisos de RH, alertas de discrepancias y reportes.

## Endpoints

`POST /logs/query` (bitácora paginada), `POST /logs/:id/retry`, `POST /logs/:id/cancel`.

## Modelos

`EmailLog`.

## Permisos

`system.configure`.

## Dependencias

`core/services/mail` (cola), configuración en `config` (sys-config).

## Notas multi-tenant

- El remitente y la plantilla deben poder personalizarse por tenant (marca del cliente).
- En SaaS conviene un proveedor con subcuentas o dominios verificados por cliente (Resend/SES) y aislamiento de reputación: un cliente con spam no debe quemar el dominio de todos.
- Rate limit por tenant para evitar que un cliente sature la cola de los demás.
