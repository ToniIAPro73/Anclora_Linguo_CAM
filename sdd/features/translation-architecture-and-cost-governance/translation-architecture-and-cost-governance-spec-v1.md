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
  - micro-batching de traducciones parciales en WS para reducir inferencias MT,
  - smart chunking adaptativo de audio (`fast/normal/stable`) segun jitter/perdida/latencia,
  - control de carga por backpressure en WS (descarta chunks bajo congestion para evitar backlog),
  - deteccion automatica basica de idioma (LID heuristico) cuando `myLang=auto`,
  - cuotas por sesion para traduccion y TTS,
  - estimacion de coste por sesion (`/api/sessions/cost`),
  - guardrails anti-abuso con rate limiting por IP/sesion en endpoints criticos y WS,
  - endpoint de consumo de sesion (`/api/sessions/usage`),
  - UI con consumo de cuota en llamada,
  - doble ruta ASR seleccionable por entorno (`vosk` streaming vs `faster-whisper` calidad).
- No incluye:
  - sintetizador TTS server-side con audio binario,
  - billing persistente por organizacion.

## 3. Cambios backend
- `services/asr-mt/app/main.py`
  - quota envs: `MAX_TRANSLATION_CHARS_PER_SESSION`, `MAX_TTS_CHARS_PER_SESSION`.
  - controles de micro-batch en WS:
    - `MT_MICRO_BATCH_WINDOW_MS`
    - `MT_MICRO_BATCH_MAX_ITEMS`
    - `MT_MICRO_BATCH_MAX_CHARS`
  - controles anti-abuso:
    - `RATE_LIMIT_WINDOW_SECONDS`
    - `RATE_LIMIT_AUTH_SESSION_PER_WINDOW`
    - `RATE_LIMIT_CHAT_TRANSLATE_PER_WINDOW`
    - `RATE_LIMIT_CHAT_TTS_PER_WINDOW`
    - `RATE_LIMIT_ROOMS_PER_WINDOW`
    - `RATE_LIMIT_TELEMETRY_PER_WINDOW`
    - `RATE_LIMIT_WS_MESSAGES_PER_WINDOW`
  - seleccion ASR por `ASR_BACKEND` (`mock|vosk|faster-whisper`) con aliases `streaming|quality`.
  - buckets de uso en memoria por `user_id`.
  - cache en memoria por par de idiomas + texto.
  - traduccion por lotes con cache (`_translate_with_cache_many`) para parciales.
  - endpoints nuevos:
    - `POST /api/chat/tts`
    - `POST /api/sessions/usage`
    - `POST /api/sessions/cost`
  - `POST /api/chat/translate` ahora aplica cuota + audit de uso.

- `services/asr-mt/app/backends.py`
  - `VoskASRBackend` para ruta de baja latencia (streaming en CPU).
  - `FasterWhisperASRBackend` mantiene ruta de mayor calidad.
  - `translate_many` en MT para inferencia batch real sobre modelos Transformers/Marian.

## 4. Cambios frontend
- `App.tsx`
  - `speakMessage` migra a `POST /api/chat/tts`.
  - refresco de consumo de cuota despues de traducir/hablar.
  - estabilizacion de subtitulos con `confirmed_text + hypothesis_text`.
  - ajuste dinamico de `chunkSize` del AudioWorklet en llamada activa.
  - emite `session_cost_estimated_eur` en evento de fin de llamada.
  - emite telemetria de backpressure (`audio_backpressure_started/recovered`, dropped chunks).
  - fija `myLang` automaticamente tras deteccion con confianza en flujo `auto`.
- `utils/languageDetection.ts`
  - heuristica lightweight para alfabetos y palabras frecuentes (es/en/fr/de/it/pt/ru/ja/ko/zh).
- `hooks/useStreamingTranslation.ts`
  - aplica umbral `maxBufferedBytes` sobre `WebSocket.bufferedAmount` con hysteresis.
- `components/VideoGrid.tsx`
  - render diferenciado de hipotesis (tenue) y texto confirmado.
- `audio-worklet-processor.js`
  - permite reconfigurar `chunkSize` en caliente sin reiniciar stream.

## 5. Seguridad y coste
- Traduccion/TTS pasan por backend autenticado con token firmado.
- Cuotas por sesion impiden consumo ilimitado.
- Cache reduce coste y latencia para textos repetidos.
- Micro-batching reduce coste CPU en rachas de parciales seguidos.
- Chunking adaptativo evita backlog en red degradada y reduce TTFC cuando la red es estable.
- Rate limits limitan abuso y picos de trafico sobre endpoints sensibles.

## 6. Criterios de aceptacion
- [x] TTS chat usa backend y no SDK cliente.
- [x] Cuota por sesion funciona para MT y TTS.
- [x] UI muestra consumo de sesion.
- [x] Ruta ASR se puede elegir por entorno (`streaming` o `quality`).
- [x] Backend MT soporta micro-batching configurable para parciales WS.
- [x] Smart chunking de audio se adapta en runtime sin reiniciar llamada.
- [x] Backpressure guard evita crecimiento no acotado del buffer WS en red degradada.
- [x] LID basico fija idioma local automaticamente cuando estaba en `auto`.
- [x] Guardrails anti-abuso aplican limites de peticiones/mensajes configurables.
- [x] Backend expone estimacion de coste de sesion basada en uso.
- [x] Variables de entorno y README actualizados.
- [x] `npm run lint` y `npm run build` en verde.
