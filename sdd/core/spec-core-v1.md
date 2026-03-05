# Spec Core v1 — Arquitectura base Anclora Linguo CAM

## 1. Capas del sistema
- Frontend React/Vite: orquesta llamada, subtitulos, chat y controles.
- Signaling (PeerJS): establecimiento de pares WebRTC.
- Media plane (WebRTC): audio/video directo entre participantes.
- ASR/MT WS (FastAPI): transcripcion y traduccion streaming.
- TURN/STUN: conectividad robusta en redes con NAT restrictivo.

## 2. Contratos base
- Configuracion runtime centralizada por entorno.
- Hooks especializados por dominio (`useStreamingTranslation`, `useRecording`, `useWebRtcStats`).
- Mecanismos de teardown explicitos para media, sockets y worklets.

## 3. SLO/SLI minimos sugeridos
- SLI llamada estable: tasa de sesion completada.
- SLI traduccion: latencia parcial/final de subtitulos.
- SLI red: jitter, packet loss, reconexiones.

## 4. Regla de evolucion
Todo cambio transversal al core requiere nueva version de spec core y entrada en `sdd/core/CHANGELOG.md`.
