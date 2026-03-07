# Test Plan — translation-architecture-and-cost-governance (v1)

## Suite minima obligatoria
- npm run lint
- npm run build
- Prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos funcionales
1. Translate quota
- Consumir traducciones hasta superar limite.
- Esperado: backend responde 429.

2. TTS quota
- Consumir TTS repetidamente hasta limite.
- Esperado: backend responde 429.

3. Usage endpoint
- Consultar `/api/sessions/usage` durante sesion.
- Esperado: contadores aumentan tras translate/tts.

4. Cache hit
- Traducir el mismo texto varias veces.
- Esperado: misma salida con latencia reducida y sin error.

5. Subtitle stabilization
- Durante llamada, forzar habla continua y observar subtitulos parciales.
- Esperado: el texto confirmado no retrocede y la hipotesis se muestra con estilo tenue.

6. ASR route: streaming (Vosk)
- Configurar `ASR_BACKEND=streaming`.
- Esperado: el servicio arranca y emite parciales/finales en WebSocket.

7. ASR route: quality (Faster Whisper)
- Configurar `ASR_BACKEND=quality`.
- Esperado: el servicio arranca y mantiene salida de subtitulos sin cambiar contrato WS.

8. MT micro-batching WS
- Configurar `MT_MICRO_BATCH_WINDOW_MS=35` y generar rafaga de parciales.
- Esperado: traduccion enviada en lotes cortos conservando orden de subtitulos.

9. MT micro-batching disabled
- Configurar `MT_MICRO_BATCH_WINDOW_MS=0`.
- Esperado: cada parcial se traduce/publica inmediatamente (sin agrupacion temporal).

10. Smart chunking adaptativo
- Durante llamada, forzar condiciones de red mala (perdida/jitter) y luego red estable.
- Esperado: evento `audio_chunk_profile_changed` cambia entre `stable`/`normal`/`fast` y el stream no se reinicia.

11. Session cost endpoint
- Consumir translate/tts y consultar `POST /api/sessions/cost`.
- Esperado: `estimated_total_cost_eur` > 0 y coherente con chars consumidos.

11. Rate limit chat translate
- Configurar `RATE_LIMIT_CHAT_TRANSLATE_PER_WINDOW=2` y ejecutar 3 requests en <60s.
- Esperado: tercera request responde 429.

12. Rate limit ws messages
- Configurar `RATE_LIMIT_WS_MESSAGES_PER_WINDOW` bajo y enviar audio continuo.
- Esperado: backend emite error y cierra WS con codigo de overload.

## Resultado actual
- lint: PASS
- build: PASS
- pruebas manuales de cuota/cache: PENDIENTE
