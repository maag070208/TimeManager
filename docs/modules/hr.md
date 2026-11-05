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
| Expediente | `POST /query`, `GET /stats`, `GET /:id`, `PATCH /:id/profile`, `POST /:id/photo`, `PUT /:id/discounts`, `POST /assignment` |
| Documentos | `GET/POST /:id/documents`, `DELETE /:id/documents/:docId`, `GET /:id/documents/:docId/download` |
| Catálogos | `GET/POST/PATCH/DELETE /catalogs/document-types|genders|blood-types` |
| Actas | `POST /disciplinary-reports`, `POST /disciplinary-reports/query`, `GET /disciplinary-reports/:id`, `GET /disciplinary-reports/employee/:id`, `DELETE /disciplinary-reports/:id` |
| Avisos | `POST /:id/notify-registration`, `POST /:id/notify-missing-records`, `POST /notify-missing-records` |

## Modelos

`User` (expediente extendido: RFC, CURP, NSS, dirección, contacto de emergencia, etc.), `EmployeeDocument`, `DocumentType`, `Gender`, `BloodType`, `DisciplinaryReport`, `EmployeeDiscount`.

## Permisos

`hr.view`, `hr.manage`, `hr.records` (bajas de personal, compartido con `users`).

## Frontend

`pages/employees/*`, `features/hr/*` (employee-detail, employee-records-board, disciplinary-reports), `features/user/employees-list`, `entities/hr`, `widgets/employee-credential`, `widgets/disciplinary-report`.

## Dependencias

- `users`: la identidad base es `User`; RH solo extiende el expediente.
- `core/services/storage`: fotos y documentos (S3).
- `notifications` / `email`: avisos de expediente incompleto.

## Notas multi-tenant

- Datos personales sensibles (RFC/CURP/NSS, médicos, documentos): cifrado en reposo y acceso por rol ya son requisito NOM; en SaaS se vuelven requisito contractual por cliente.
- Documentos en S3: prefijo de ruta por tenant para aislamiento y borrado por cliente (offboarding).
- Catálogos (`Gender`, `BloodType`, `DocumentType`): decidir si son globales del sistema o personalizables por cliente (ver SAAS_PLAN).
