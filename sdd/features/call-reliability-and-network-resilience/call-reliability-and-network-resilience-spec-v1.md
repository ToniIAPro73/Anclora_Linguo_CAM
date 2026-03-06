# SPEC — call-reliability-and-network-resilience (v1)

## 0. Meta
- Feature: call-reliability-and-network-resilience
- Version: v1
- Estado: implemented

## 1. Objetivo
Aumentar resiliencia de llamada en redes inestables con reconexion automatica en signaling y subtitulado WS, configuracion de ICE/TURN por entorno y mejor visibilidad de estado de conexion.

## 2. Alcance
- Incluye:
  - reconexion WS ASR/MT con backoff exponencial,
  - estado de conexion en UI para signaling y subtitulos,
  - reconexion de PeerJS en `disconnected`,
  - datachannels duales para subtitulos (`captions_hyp` no fiable y `captions_commit` fiable),
  - VAD con endpointing configurable (`min_speech_ms`, `min_silence_ms`, `max_segment_ms`, `hangover_ms`),
  - ajuste adaptativo de endpointing segun jitter/perdida en tiempo real,
  - modo topologia configurable (`p2p` default, `sfu` por feature flag con redireccion a URL externa),
  - persistencia opcional de salas con `STORAGE_BACKEND=sqlite` para sobrevivir reinicios,
  - avisos operativos de red,
  - parametrizacion y verificacion de TURN/ICE por entorno.
- No incluye:
  - despliegue de infraestructura TURN productiva,
  - auto-healing de medios RTP mas alla de capacidades nativas WebRTC.

## 3. Cambios en frontend
- `hooks/useStreamingTranslation.ts`:
  - estados `idle/connecting/connected/reconnecting/error`.
  - reconexion automatica con max 5 intentos y backoff.
  - fix de restart por cambio de idioma.
  - propagacion de eventos `segment_end` desde AudioWorklet a backend ASR/MT.
- `App.tsx`:
  - estado de signaling PeerJS (`connected/reconnecting/down`).
  - reconexion `peer.reconnect()` en `disconnected`.
  - envio de hipotesis en canal no fiable (`maxRetransmits:0`) y commits en canal fiable.
  - perfil de endpointing dinamico (`normal/aggressive`) segun `jitterMs` y `packetLossPct`.
  - avisos de red y degradacion en runtime.
  - bloqueo de inicio de llamada si signaling no esta conectado.
- `audio-worklet-processor.js`:
  - VAD por chunk con corte por silencio y por duracion maxima de segmento.
  - hangover de silencio para no truncar finales de palabra.
- `services/asr-mt/app/main.py`:
  - nuevo mensaje WS `segment_end` para emitir `final` sin cerrar websocket.
- `components/CallHeader.tsx`:
  - nuevos indicadores de salud de signaling y subtitulado.
- `constants.ts`:
  - deteccion `HAS_TURN_SERVER` para control de riesgo de NAT.
  - `VITE_CALL_TOPOLOGY` y `VITE_SFU_JOIN_URL` para handoff opcional a SFU externo.

## 4. Cambios de configuracion
- `.env.example` con variables VITE para signaling, ASR/MT e ICE.
- `README.md` actualizado para runbook local sin secretos cliente.

## 5. Criterios de aceptacion
- [x] WS de traduccion reintenta automaticamente tras fallo transitorio.
- [x] PeerJS intenta reconexion tras perdida de signaling.
- [x] Hipotesis de subtitulos priorizan latencia con canal no fiable.
- [x] Commits finales de subtitulos viajan por canal fiable.
- [x] Endpointing por silencio/max-segment fuerza commits sin cerrar stream.
- [x] Endpointing se vuelve mas agresivo cuando suben jitter/perdida.
- [x] Topologia de llamada se puede configurar por entorno (`p2p` o `sfu`).
- [x] UI expone estado de red para troubleshooting operativo.
- [x] Configuracion ICE/TURN queda parametrizada por entorno.
- [x] `npm run lint` y `npm run build` en verde.

## 6. Riesgos residuales
- Sin TURN real en produccion, persistira riesgo de fallo en NAT restrictivo.
- Falta validacion manual multi-red (wifi domestica, 4G/5G, red corporativa).
