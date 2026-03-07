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

6. Restart test con persistencia sqlite
- Levantar backend con `STORAGE_BACKEND=sqlite`.
- Registrar 2 peers en sala, reiniciar backend y repetir registro/resolucion.
- Verificar que nuevas sesiones de pairing no quedan corruptas tras restart.

7. Endpointing por silencio
- Hablar una frase corta y pausar (> `min_silence_ms`).
- Verificar que se emite `final` sin cerrar WS y llega commit remoto.

8. Endpointing adaptativo por red
- Simular perdida/jitter alto y observar telemetria `endpointing_profile_changed`.
- Verificar cambio a perfil `aggressive` y menor tiempo hasta commit final.

9. Modo SFU por feature flag
- Configurar `VITE_CALL_TOPOLOGY=sfu` y `VITE_SFU_JOIN_URL` valido.
- Verificar que iniciar llamada abre URL SFU con `room` y `name` en query.

10. E2EE insertable streams
- Configurar `VITE_ENABLE_INSERTABLE_E2EE=true` y `VITE_E2EE_SHARED_KEY`.
- Verificar en llamada activa que el header muestra `E2EE ENABLED`.
- En navegador sin soporte, verificar `E2EE UNSUPPORTED` y telemetria `e2ee_unsupported`.

11. Dedupe/out-of-order de subtitulos
- Inyectar subtitulos con `seq` repetido o menor al ultimo commit.
- Verificar que el render remoto ignora duplicados/mensajes atrasados.

## Resultado actual
- lint: PASS
- build: PASS
- validacion manual multi-red: PENDIENTE
