# Lucía Herrera Campos

- **Cuenta:** `cast.employees[0]`, `CLIENT_STAFF`, núm. 201, Almacén.
- **Antigüedad para vacaciones:** 4 años en 2027 → 18 días.

## Cómo checa
- Presencial con GPS, comida completa.
- Primero sin marcaje remoto (403 `REMOTE_PUNCH_DISABLED`) y sin acuerdo (403 `REMOTE_AGREEMENT_REQUIRED`); luego acepta un acuerdo solo de reloj (sigue bloqueada) y al final CLOCK + REMOTE.
- Envía una entrada offline y la reintenta con el mismo `clientEventId`: no se duplica.

## Permisos
- Pide vacaciones normales, cruzando fin de semana y festivos; cancela una pendiente.
- No puede aprobar ni cancelar lo ya aprobado; recibe aviso cuando RH decide.

## Lo que no debe pasar
- No lee ni cambia la configuración NOM; no se cambia a sí misma el modo de checada.
