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

## Resultado actual
- lint: PASS
- test: PASS
- build: PASS
- verificacion manual de eventos en entorno local: PENDIENTE
