# Test Plan — observability-and-operational-excellence (v1)

## Suite minima obligatoria
- npm run lint
- npm run test
- npm run build
- Prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos funcionales
1. Precheck telemetry
- Ejecutar pre-check y confirmar evento `precheck_result`.

2. Reconnect telemetry
- Simular reconexion de signaling/subtitulos y confirmar eventos.

3. Session summary
- Consultar `POST /api/telemetry/summary`.
- Validar conteos agregados esperados.

4. Subtitle E2E metrics
- Iniciar llamada y generar subtitulos locales/remotos.
- Colgar llamada y consultar `POST /api/telemetry/summary`.
- Validar campos:
  - `ttfc_ms_p50`, `ttfc_ms_p95`
  - `caption_lag_ms_p50`, `caption_lag_ms_p95`
  - `dropped_hypothesis_rate_pct_avg`

## Resultado actual
- lint: PASS
- test: PASS
- build: PASS
- verificacion manual de eventos en entorno local: PENDIENTE
