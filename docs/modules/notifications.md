# notifications — Notificaciones in-app

Notificaciones dentro de la app con contador de no leídas, marcado individual/masivo y push en tiempo real vía Ably.

## Endpoints

`GET /`, `GET /unread-count`, `POST /:id/read`, `POST /read-all`, `DELETE /:id`.

## Modelos

`Notification`.

## Frontend

`pages/notifications/*`, `features/notification/list`, hook `useAblyNotifications` (realtime + toast).

## Notas multi-tenant

- Los canales de Ably deben namespacerse por tenant (`tenant:<id>:user:<id>`) para no filtrar eventos entre clientes.
- Volumen medio; índice por `(tenantId, userId, read)`.
- Ably es opcional: con polling funciona igual, lo que simplifica self-hosting para clientes que lo pidan.
