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

## Resultado actual
- lint: PASS
- build: PASS
- pruebas manuales de cuota/cache: PENDIENTE
