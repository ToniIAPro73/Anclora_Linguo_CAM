# BASELINE OBLIGATORIO QA/GATE (todas las features)

## 1) Validacion de entorno (obligatoria)
- Confirmar variables activas para signaling, ASR/MT y TURN.
- Confirmar que no hay secretos embebidos en frontend.
- Si hay hardcodes de entorno, reportar `ENV_CONFIG_HARDCODED`.

## 2) Validacion funcional minima
- Ejecutar `npm run lint`.
- Ejecutar `npm run build`.
- Validar manualmente llamada 1:1:
  - audio,
  - video,
  - subtitulos,
  - chat,
  - colgar y teardown.

## 3) Validacion de red y subtitulos
- Confirmar conexion/reconexion en fallo transitorio.
- Confirmar degradacion controlada cuando traduccion no disponible.
- Si cae fiabilidad critica de llamada: `CALL_FLOW_REGRESSION_P0`.

## 4) Reglas de decision en Gate
- Cualquier codigo NO-GO activo -> NO-GO.
- Solo emitir GO con evidencias de checks tecnicos y prueba manual.

## 5) Limpieza
- Verificar eliminacion de artefactos temporales (`tmp_*`, `debug_*`, `verify_*`).
