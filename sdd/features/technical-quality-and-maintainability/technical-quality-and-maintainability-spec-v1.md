# SPEC — technical-quality-and-maintainability (v1)

## 0. Meta
- Feature: technical-quality-and-maintainability
- Version: v1
- Estado: implemented

## 1. Objetivo
Reducir deuda tecnica en flujo de llamada corrigiendo riesgos de grabacion y mejorando mantenibilidad mediante utilidades tipadas y tests automatizados.

## 2. Alcance
- Incluye:
  - fix del loop de grabacion basado en ref (evita closure stale),
  - limpieza robusta de recursos de grabacion (AudioContext, streams, RAF),
  - utilidades de sesion de llamada desacopladas en `utils/callSession.ts`,
  - tests unitarios para utilidades criticas.
- No incluye:
  - suite e2e con navegador real.

## 3. Cambios aplicados
- `hooks/useRecording.ts`
  - `isRecordingRef` como fuente de verdad para draw loop.
  - cleanup centralizado de recursos multimedia.
- `utils/callSession.ts`
  - `normalizeRoomCode`, `buildInviteLink`, `shouldInitiateCall`, `stopMediaStream`.
- `utils/callSession.test.ts`
  - cobertura de utilidades de sesion y cleanup.
- `App.tsx`
  - uso de utilidades para reducir logica repetida.

## 4. Criterios de aceptacion
- [x] Riesgo de parada temprana de grabacion corregido.
- [x] Limpieza de recursos tras stop/end call robusta.
- [x] Tests automatizados agregados y pasando.
- [x] `npm run lint`, `npm run test`, `npm run build` en verde.
