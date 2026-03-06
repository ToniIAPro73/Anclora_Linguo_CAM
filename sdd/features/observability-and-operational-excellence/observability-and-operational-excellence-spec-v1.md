# SPEC — observability-and-operational-excellence (v1)

## 0. Meta
- Feature: observability-and-operational-excellence
- Version: v1
- Estado: implemented

## 1. Objetivo
Proveer trazabilidad operativa de llamada y traduccion con eventos estructurados para detectar degradaciones y mejorar decisiones de producto/comercial.

## 2. Alcance
- Incluye:
  - ingesta backend de eventos de telemetria,
  - resumen agregado por sesion,
  - emision frontend en hitos clave (pre-check, reconexiones, call start/end),
  - instrumentacion de subtitulos end-to-end (TTFC, caption lag y dropped hypothesis rate),
  - configuracion de limites de eventos por sesion.
- No incluye:
  - dashboard grafico externo (Grafana/BI).

## 3. Cambios backend
- `services/asr-mt/app/main.py`
  - `POST /api/telemetry/events`
  - `POST /api/telemetry/summary`
  - almacenamiento in-memory acotado por `MAX_TELEMETRY_EVENTS_PER_SESSION`,
  - resumen ampliado con percentiles de `ttfc_ms` y `caption_lag_ms`.

## 4. Cambios frontend
- `App.tsx`
  - helper `trackTelemetry`.
  - eventos emitidos:
    - `precheck_result`
    - `waiting_in_room`
    - `call_attempt_started`
    - `call_started`
    - `call_transport_error`
    - `peer_reconnecting`
    - `subtitle_reconnecting`
    - `subtitle_error`
    - `caption_ttfc`
    - `caption_metrics`
    - `call_ended`

## 5. Criterios de aceptacion
- [x] Eventos de red/traduccion se envian a backend.
- [x] Eventos de producto (precheck, call start/end) quedan registrados.
- [x] Se registran metricas de subtitulos (ttfc, lag, dropped rate) por sesion.
- [x] Existe endpoint de resumen para operacion.
- [x] `npm run lint`, `npm run test`, `npm run build` en verde.
