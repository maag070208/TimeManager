# Códigos de error para soporte (AX)

La persona nunca ve detalles técnicos. Cuando algo falla por nuestro lado, ve un mensaje amable con un código entre corchetes:

> [AX-01] Algo salió mal de nuestro lado. Intenta de nuevo en un momento; si sigue pasando, comparte este código con soporte.

Soporte pide ese código, la hora aproximada y el cliente. Con eso se busca en el log del API: cada error técnico se registra con el código al frente (`[AX-01] GET /api/v1/... → ...`) y con el `requestId` de la petición.

Los errores de negocio (lo que la persona puede corregir: «El RFC no tiene un formato válido», «Ya existe un cliente con ese subdominio», etc.) **no** llevan código; ya dicen qué hacer.

## Diccionario

| Código | Qué pasó (para soporte) | Lo genera | Qué revisar |
|---|---|---|---|
| **AX-01** | El API no pudo conectarse a la base de datos (Prisma P1001, P1002, P1017 o error de inicialización) | API (`DATABASE_UNAVAILABLE`, 503) | Estado de la base en Railway, `DATABASE_URL`, red del servidor |
| **AX-02** | La base tardó demasiado: pool de conexiones agotado, operación o transacción vencida (P1008, P2024, P2028) | API (`DATABASE_TIMEOUT`, 503) | Consultas lentas, `connection_limit`, carga de la base |
| **AX-03** | Error de base de datos inesperado (otro código de Prisma, error de validación de Prisma, pánico del motor) | API (`DATABASE_ERROR`, 500) | El código de Prisma va en el log, no en la respuesta |
| **AX-04** | Error interno inesperado (una excepción no controlada) | API (`INTERNAL_ERROR`, 500) | Stack en el log |
| **AX-05** | El API no entendió la petición: cuerpo ilegible o ruta inexistente. Casi siempre es una web o app desactualizada | API (`INVALID_BODY`, `ROUTE_NOT_FOUND`) | Versión de la app; ruta en el log |
| **AX-06** | Un servicio interno no está configurado o falló: archivos (S3) o notificaciones en vivo (Ably) | API (`STORAGE_NOT_CONFIGURED`, `ABLY_NOT_CONFIGURED`, `ABLY_TOKEN_FAILED`) | Variables de entorno y estado del proveedor |
| **AX-10** | Sin conexión con el servidor: la petición no recibió respuesta | Web y app | Internet de la persona, DNS, que el API esté arriba |
| **AX-11** | El servidor tardó demasiado en responder | Web y app | Latencia del API y de la base |
| **AX-12** | Respondió la infraestructura, no el API (502, 503 o 504 sin el formato del API): despliegue en curso o API caído | Web y app | Despliegues y estado del servicio en Railway |
| **AX-13** | Respuesta inesperada: un error sin el formato del API o datos que la web o la app no pudieron leer | Web y app | Versión de la app frente a la del API |
| **AX-14** | Error inesperado en la pantalla (excepción de JavaScript o de la librería). En la web, si la pantalla truena se muestra a Tic con este código y el botón «Recargar» | Web | Consola del navegador (`[AX-14]`) |

## Dónde vive

- **API:** `SUPPORT_CODES` en `api/src/core/middlewares/error.middleware.ts`. La respuesta trae `supportCode` y el mensaje empieza con `[AX-NN]`. Textos en `api/src/core/i18n/messages/{es,en}.ts`.
- **Web:** `web/src/shared/api/errors.ts`. Toda pantalla muestra los errores con `errorMessage(error, textoDeRespaldo)`: el mensaje del API tal cual, o AX-14 con el texto de la pantalla. Nunca `error.message` directo. Para una validación local que sí debe mostrarse tal cual, se lanza `UserMessageError`. Pantalla de error: `shared/ui/error-boundary`.
- **App móvil:** `SupportCode` en `checklab/shared/.../core/network/ApiException.kt`; `apiCall` convierte cualquier falla en `ApiException` con un mensaje que se puede mostrar.

## Agregar un código

1. Se elige el siguiente número libre: del API, AX-07 en adelante (hasta AX-09); de la web o la app, AX-15 en adelante.
2. Se agrega a esta tabla y en el mismo cambio al código (API: `SUPPORT_CODES`; web y app: su lista).
3. Nunca se reusa un código retirado: soporte puede tener tickets con él.
