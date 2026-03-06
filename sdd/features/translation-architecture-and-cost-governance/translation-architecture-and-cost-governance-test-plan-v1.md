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

## Resultado actual
- lint: PASS
- build: PASS
- pruebas manuales de cuota/cache: PENDIENTE
