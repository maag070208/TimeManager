# notifications — Notificaciones in-app

Notificaciones dentro de la app con contador de no leídas, marcado individual/masivo y push en tiempo real vía Ably.

## Endpoints

`GET /`, `GET /unread-count`, `GET /ably-token`, `POST /:id/read`, `POST /read-all`, `DELETE /:id`.

## Modelos

`Notification`.

## Tiempo real (Ably por token)

El navegador **no** recibe la app key. `GET /notifications/ably-token` (solo `authenticate`, sin permiso extra) devuelve un **Ably TokenRequest** firmado en el servidor con `env.ABLY_API_KEY`:

- `clientId` = id del usuario autenticado.
- `capability` = `{ "user:<id>": ["subscribe"] }` (no puede publicar ni suscribirse a otros canales).
- `ttl` = 1 h; Ably pide un token nuevo con `authCallback` al vencer.
- Si falta la key o el SDK no puede firmar → `503` con código `ABLY_NOT_CONFIGURED` / `ABLY_TOKEN_FAILED`.

El API publica el evento `NOTIFICATION` en el canal con espacio de cliente
`tenant:<tenantId>:user:<userId>` y, durante la transición (F1B-05), también en
el histórico `user:<id>` (`api/src/core/services/ably.ts`, `broadcastToUser`).
La web (`web/src/shared/lib/ably.ts` + `useAblyNotifications`) usa `authCallback`
con el cliente axios autenticado y `clientId`; se suscribe a
`tenant:<tenantId>:user:<userId>` cuando la sesión tiene cliente y a `user:<id>`
solo para el personal de plataforma sin cliente. Si el endpoint responde 503
desactiva el tiempo real y la app sigue funcionando (la campanita se actualiza al
recargar).

## Frontend

`pages/notifications/*`, `features/notification/list`, hook `useAblyNotifications` (realtime + toast).

## Notas multi-tenant

- Cada token solo alcanza el canal `user:<id>` de su dueño; como los ids de usuario son únicos entre clientes, no hay cruce de eventos. Si en el futuro se comparte una app de Ably con canales de plataforma, namespacerse por tenant (`tenant:<id>:user:<id>`).
- Volumen medio; índice por `(tenantId, userId, read)`.
- Ably es opcional: con polling funciona igual, lo que simplifica self-hosting para clientes que lo pidan.

## Limpieza heredada

- `Notification.ticketId` era residuo del ERP de tickets y se eliminó en L-10
  (migración `20261110000000_legacy_cleanup`): ya no está en el modelo, DTO,
  entity ni en los tipos web. Los publicadores muertos (`broadcastTicketEvent`,
  `broadcastDashboardEvent`) y el canal `dashboard` ya se habían eliminado de
  `api/src/core/services/ably.ts` (F1C-02).
