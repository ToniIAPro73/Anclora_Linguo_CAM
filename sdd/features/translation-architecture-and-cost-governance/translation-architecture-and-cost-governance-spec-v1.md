# SPEC — translation-architecture-and-cost-governance (v1)

## 0. Meta
- Feature: translation-architecture-and-cost-governance
- Version: v1
- Estado: implemented

## 1. Objetivo
Consolidar traduccion y TTS bajo backend gestionado y agregar gobernanza de coste por sesion con cuotas y observabilidad de consumo.

## 2. Alcance
- Incluye:
  - endpoint backend para TTS logical flow (`/api/chat/tts`),
  - cache de traducciones en backend,
  - cuotas por sesion para traduccion y TTS,
  - endpoint de consumo de sesion (`/api/sessions/usage`),
  - UI con consumo de cuota en llamada,
  - doble ruta ASR seleccionable por entorno (`vosk` streaming vs `faster-whisper` calidad).
- No incluye:
  - sintetizador TTS server-side con audio binario,
  - billing persistente por organizacion.

## 3. Cambios backend
- `services/asr-mt/app/main.py`
  - quota envs: `MAX_TRANSLATION_CHARS_PER_SESSION`, `MAX_TTS_CHARS_PER_SESSION`.
  - seleccion ASR por `ASR_BACKEND` (`mock|vosk|faster-whisper`) con aliases `streaming|quality`.
  - buckets de uso en memoria por `user_id`.
  - cache en memoria por par de idiomas + texto.
  - endpoints nuevos:
    - `POST /api/chat/tts`
    - `POST /api/sessions/usage`
  - `POST /api/chat/translate` ahora aplica cuota + audit de uso.

- `services/asr-mt/app/backends.py`
  - `VoskASRBackend` para ruta de baja latencia (streaming en CPU).
  - `FasterWhisperASRBackend` mantiene ruta de mayor calidad.

## 4. Cambios frontend
- `App.tsx`
  - `speakMessage` migra a `POST /api/chat/tts`.
  - refresco de consumo de cuota despues de traducir/hablar.
  - estabilizacion de subtitulos con `confirmed_text + hypothesis_text`.
- `components/VideoGrid.tsx`
  - render diferenciado de hipotesis (tenue) y texto confirmado.

## 5. Seguridad y coste
- Traduccion/TTS pasan por backend autenticado con token firmado.
- Cuotas por sesion impiden consumo ilimitado.
- Cache reduce coste y latencia para textos repetidos.

## 6. Criterios de aceptacion
- [x] TTS chat usa backend y no SDK cliente.
- [x] Cuota por sesion funciona para MT y TTS.
- [x] UI muestra consumo de sesion.
- [x] Ruta ASR se puede elegir por entorno (`streaming` o `quality`).
- [x] Variables de entorno y README actualizados.
- [x] `npm run lint` y `npm run build` en verde.
