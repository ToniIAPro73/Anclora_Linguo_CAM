# Test Plan — call-reliability-and-network-resilience (v1)

## Suite minima obligatoria
- npm run lint
- npm run build
- Prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos de red
1. Reconexion WS subtitulos
- Forzar caida temporal de servicio ASR/MT.
- Verificar estado `SUBTITLES RECONNECTING` y recuperacion automatica.

2. Reconexion signaling
- Forzar corte temporal de peer-server.
- Verificar estado `SIGNAL RECONNECTING` y recuperacion via `peer.reconnect()`.

3. Guardrail TURN
- Ejecutar sin TURN en `VITE_ICE_SERVERS`.
- Verificar warning operativo en UI.

4. Teardown limpio
- Colgar llamada en medio de reconexion.
- Verificar limpieza de streams/canales y retorno a `IDLE`.

5. Datachannel dual de subtitulos
- Verificar que hipotesis fluyen por `captions_hyp` y pueden perderse sin bloquear cola.
- Verificar que commits finales llegan por `captions_commit` y se renderizan correctamente.

## Resultado actual
- lint: PASS
- build: PASS
- validacion manual multi-red: PENDIENTE
