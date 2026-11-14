# Plataforma (equipo CheckLab)

- **Cuenta:** `cast.platform`, rol `ADMIN`, sin cliente. Credenciales en `api/qa/.env.qa` (`QA_PLATFORM_USER` / `QA_PLATFORM_PASS`).
- **Quién es:** la persona de CheckLab que vende y da soporte.

## Qué hace
- Da de alta el cliente de cada corrida (`qa-<sello>`, zona `America/Mexico_City`) y el cliente intruso.
- Entra a un cliente con `X-Tenant-Id` para dar soporte.

## Qué debe poder
- Crear, editar y suspender clientes; asignar plan y canales de checada.
- Ver la auditoría de todos los clientes.

## Qué no
- No aparece en la plantilla de ningún cliente ni checa.
