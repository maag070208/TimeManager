# Intrusos: Tomás Intruso Gil e Iván Ajeno Cruz

- **Cuentas:** `cast.intruderAdmin` (`CLIENT_ADMIN`) y `cast.intruderEmployee` (`CLIENT_STAFF`, núm. 900) del cliente `Intruso QA <sello>`.
- **Para qué existen:** comprobar que un cliente nunca ve ni toca datos de otro.

## Lo que intentan y debe fallar
- Listar, decidir o editar solicitudes, tipos de permiso y festivos del otro cliente.
- Ver el padrón de teletrabajo, los checklists o los avisos del otro cliente.
- Que el export STPS o el CSV del otro cliente traigan a sus personas.

## Lo que sí deben poder
- Operar su propio cliente: aceptar su método de registro y checar remoto.
