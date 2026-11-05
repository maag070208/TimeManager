# hr — Expediente de personal

Expediente completo del empleado: datos personales y fiscales, foto, documentos, descuentos, actas administrativas y catálogos de RH.

## Qué hace

- **Expediente**: consulta (`POST /query`), detalle, edición de perfil (`PATCH /:id/profile`), foto (`POST /:id/photo`), stats (`GET /stats`).
- **Documentos**: CRUD de documentos por empleado con descarga (`EmployeeDocument`), catálogo de tipos (`DocumentType`).
- **Catálogos**: géneros (`Gender`), tipos de sangre (`BloodType`), tipos de documento.
- **Actas administrativas**: crear/consultar/borrar `DisciplinaryReport`, por empleado o tabla.
- **Descuentos**: `PUT /:id/discounts` (`EmployeeDiscount`).
- **Notificaciones de RH**: aviso de registro y de expediente incompleto (individual y masivo).
- **Asignación**: `POST /assignment` (organización: departamento/subárea).

## Endpoints (agrupados)

| Grupo | Rutas |
|---|---|
| Expediente | `POST /query`, `GET /stats`, `GET /:id`, `GET /:id/overview`, `PATCH /:id/profile`, `POST /:id/photo`, `PUT /:id/discounts`, `POST /assignment` |
| Foto | `GET /:id/photo/raw?token=<firma>` (credencial firmada de corta vida, sin `authenticate`; ver abajo) |
| Documentos | `GET/POST /:id/documents`, `DELETE /:id/documents/:docId`, `GET /:id/documents/:docId/download` |
| Catálogos | `GET/POST/PATCH/DELETE /catalogs/document-types|genders|blood-types` (las escrituras exigen `catalogs.manage`, **solo plataforma** desde L-07) |
| Actas | `POST /disciplinary-reports`, `POST /disciplinary-reports/query`, `GET /disciplinary-reports/:id`, `GET /disciplinary-reports/employee/:id`, `DELETE /disciplinary-reports/:id` |
| Avisos | `POST /:id/notify-registration`, `POST /:id/notify-missing-records`, `POST /notify-missing-records` |

## Modelos

`User` (expediente extendido: RFC, CURP, NSS, dirección, contacto de emergencia, etc.), `EmployeeDocument`, `DocumentType`, `Gender`, `BloodType`, `DisciplinaryReport`, `EmployeeDiscount`.

## Permisos

`hr.view`, `hr.manage`, `hr.records` (bajas de personal, compartido con `users`).

## Foto y archivos privados (F1C-01)

La foto y los documentos del expediente son datos personales sensibles: **nada se sirve con una URL pública de S3**.

- **Foto del empleado.** `GET /hr/:id/photo/raw` está montado en `api.router` **antes** del router de RH porque no usa `authenticate`: la web la pinta con `<img src>` y `fetch()` same-origin, sin headers. La credencial es un JWT de propósito `photo` y vida corta (5 min) con `sub` = dueño de la foto; viaja en `?token=` y **es** la autorización. El endpoint valida firma, expiración, propósito y que `sub` coincida con `:id` (401 si la credencial falta o no vale; 403 si es de otra persona). Los producers de `photoUrl` la firman con `signedPhotoPath` (`api/src/core/utils/security.ts`): `GET /auth/me`, `GET /access/lookup`, la ficha de RH (`GET /hr/:id`, `POST /hr/query`) y la respuesta del upload (`POST /hr/:id/photo`). `photoUrl` es una ruta **relativa a la base del API** (`/hr/:id/photo/raw?token=...`); la web la resuelve con `resolvePhotoUrl` (`web/src/entities/hr/lib/photoUrl.ts`), que le antepone `API_CONSTANTS.BASE_URL`.
- **Documentos del expediente.** `GET /hr/:id/documents` ya no devuelve URL pública: cada `url` es un `GetObjectCommand` **presignado** con `@aws-sdk/s3-request-presigner` (`signedObjectUrl`, 10 min). La descarga también puede hacerse por el proxy autenticado `GET /hr/:id/documents/:docId/download`. La lectura interna (`downloadObject`, adjuntos de correo) va por el SDK con credenciales IAM, nunca por URL pública.
- **Bucket privado (infraestructura).** `publicObjectUrl` se eliminó del código; el bucket S3 debe configurarse **sin lectura pública** (Block Public Access + política que solo permita `s3:GetObject`/`s3:PutObject` al rol del API). Ese cambio no se hace desde el repositorio: es una tarea de infraestructura al desplegar. Mientras el bucket siga público, los objetos siguen siendo alcanzables por quien conozca la key aunque el API ya no emita esas URLs.
- **Credenciales.** Los tokens de foto no llevan permisos: solo permiten leer una foto concreta durante minutos. No sirven para el resto de la API (no son access tokens). **Caveat:** viajan en la query (`?token=`), así que quedan en logs de acceso/proxies (hoy morgan registra la URL completa); su vida corta acota el daño y conviene redactar la query en el logging de despliegue.

## Frontend

`pages/employees/*`, `features/hr/*` (employee-detail, employee-records-board, disciplinary-reports), `features/user/employees-list`, `entities/hr` (incluye `resolvePhotoUrl`), `widgets/employee-credential`, `widgets/disciplinary-report`.

## Dependencias

- `users`: la identidad base es `User`; RH solo extiende el expediente.
- `core/services/storage`: fotos y documentos (S3 privado, URLs presignadas).
- `core/utils/security`: firma/validación de la credencial de la foto.
- `notifications` / `email`: avisos de expediente incompleto.

## Notas multi-tenant

- Datos personales sensibles (RFC/CURP/NSS, médicos, documentos): cifrado en reposo y acceso por rol ya son requisito NOM; en SaaS se vuelven requisito contractual por cliente.
- Documentos en S3: prefijo de ruta por tenant para aislamiento y borrado por cliente (offboarding); el bucket es privado y las descargas caducan.
- Catálogos (`Gender`, `BloodType`, `DocumentType`): decidir si son globales del sistema o personalizables por cliente (ver SAAS_PLAN).
