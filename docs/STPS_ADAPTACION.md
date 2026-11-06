# Adaptación del export a las disposiciones STPS

Fecha: 2026-11-05. Estado: **v2 listo, pendiente de la publicación oficial**.

## 1. Qué hay hoy

- Endpoint `GET /nom/export/stps?period=&date=&format=csv|json`.
- Version `stps-registro-jornada-v2`, versionada en `SCHEMA_VERSION` (`api/src/modules/nom/services/stps-export.service.ts`).
- Contenido:
  - Una fila por persona/día: minutos trabajados/programados/extra, dobles, triples, ilegal,
    descanso/festivo/domingo, menor, infracciones, `primeraEntrada`, `ultimaSalida`, `origen`.
  - Detalle `# marcajes` (fecha, hora, tipo, método, fuente, empleado).
  - Sección de remotos y de archivo (art. 804).
  - SHA-256 sobre el texto final, recalculable; la línea `# sha256:` se excluye del cálculo.
- El layout incluye la relación con el **convenio art. 58** (el motor marca la diferencia) y los
  ajustes aprobados ya materializados.

## 2. Qué cambia cuando publique la STPS

Checklist de adaptación (sin rehacer el modelo):

1. **Formato**: ajustar columnas/orden/CSV o XML en `StpsExportService`; subir `SCHEMA_VERSION`
   a `v3` y dejar `v2` documentado para periodos anteriores.
2. **Ámbito/excepciones**: configurar por cliente qué registros entran (p. ej. personal de
   confianza) con un campo en `nom_settings` y filtrarlo antes del export.
3. **Plazo de gracia**: mantener el cron de verificación; si hay prórroga, documentarla en
   `docs/NOM_CUMPLIMIENTO.md` y no cambiar el layout.
4. **Entrega**: definir si es descarga, API o carga a plataforma; agregar el transporte sin
   tocar el generador.
5. **Firma/sello**: si piden firma electrónica, envolver el archivo (no modificar el contenido ya
   hasheado); conservar hash y acuse.
6. **Retención**: si cambia el plazo, ajustar `LEGAL_RETENTION_MONTHS` y migrar con archivado,
   nunca borrando evidencia.
7. **Pruebas**: actualizar `nom.logic.test.ts` (layout/hash) y `nom.flow.test.ts` (integridad) con
   el nuevo esquema.

## 3. Verificación de integridad

```bash
# Descargar
curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/nom/export/stps?period=MONTH&date=2026-11-01&format=csv" -o registro.csv
# Recalcular (excluyendo la línea # sha256:)
python3 - <<'PY'
import hashlib
lines=[l for l in open('registro.csv',encoding='utf-8').read().splitlines() if not l.startswith('# sha256:')]
print(hashlib.sha256('\n'.join(lines).encode()).hexdigest())
PY
```

## 4. Riesgos

- El formato oficial puede pedir claves distintas a las columnas actuales: mantener un mapeo
  explícito, no renombrar el dominio.
- Si la autoridad exige conservar el archivo entregado, guardar el CSV + hash + acuse.
- Validar con abogado antes de declarar “cumple NOM”.
