# Credencial de empleado

Widget que dibuja la credencial del empleado como PNG tamaño INE (8.6 × 5.4 cm
a 300 DPI, 1016 × 638 px) directamente en el navegador. No hay API ni PDF de por
medio: `CredencialEmpleadoDialog` previsualiza la imagen y permite descargarla.

## QR de verificación

El QR de la credencial codifica **un único objeto JSON en UTF-8**. Al escanearlo
se obtiene la información visible de la credencial más el UUID del empleado.

### Esquema v2

| Clave  | Tipo   | Obligatorio | Origen                  | Descripción                        |
|--------|--------|-------------|-------------------------|------------------------------------|
| `v`    | number | Sí          | `QR_PAYLOAD_VERSION`    | Versión del esquema (hoy `2`).     |
| `id`   | string | Sí          | `profile.id`            | UUID del empleado (`User.id`).     |
| `no`   | string | No          | `profile.numeroEmpleado`| Número de empleado.                |
| `name` | string | No          | `profile.name`          | Nombre completo, sin truncar.      |
| `pos`  | string | No          | `profile.puesto`        | Puesto.                            |
| `dept` | string | No          | `profile.department.name`| Departamento.                     |

Ejemplo:

```json
{"v":2,"id":"8f3b…","no":"1234","name":"María G. Hernández","pos":"Recepcionista","dept":"Recepción"}
```

### Semántica

- **Campos opcionales**: se normalizan con `trim()` y se **omiten** cuando vienen
  `null` o vacíos. `v` e `id` siempre están presentes.
- **`id` es la clave de negocio**: identifica al empleado en el sistema y es lo
  que un consumidor debe usar para resolverlo; el resto de campos son
  informativos y pueden cambiar sin invalidar el identificador.
- **Orden de claves estable** para que el símbolo generado sea reproducible.
- No se incluyen campos que no se muestran en la credencial (`empresa`,
  `subarea`, `role`, tipo `t`), para no inflar el símbolo.

### Tamaño y versión

El payload pesa ~185–210 bytes, lo que da un QR de versión ~9/v10 con
corrección de errores `M`. Ese nivel `M` (~15 % de redundancia) tolera el
desgaste de una credencial impresa y plastificada sin crecer de más.

### Generación y render

- `buildQrPayload` / `serializeQrPayload` (`model/buildQrPayload.ts`) arman el
  texto.
- `generarCredencialQR` (`model/credencial.ts`) mide el símbolo con
  `QRCode.create(...).modules.size` y lo genera a `modules.size * 12` px por
  lado, `margin: 0` y los colores de marca (`PDF_COLORS.band` sobre blanco).
- `renderCredencial` dibuja el QR con `imageSmoothingEnabled = false` para que
  al reducirlo los módulos conserven bordes duros, sobre una quiet zone blanca.
