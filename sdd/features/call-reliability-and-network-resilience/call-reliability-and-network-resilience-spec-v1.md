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
- `App.tsx`:
  - estado de signaling PeerJS (`connected/reconnecting/down`).
  - reconexion `peer.reconnect()` en `disconnected`.
  - avisos de red y degradacion en runtime.
  - bloqueo de inicio de llamada si signaling no esta conectado.
- `components/CallHeader.tsx`:
  - nuevos indicadores de salud de signaling y subtitulado.
- `constants.ts`:
  - deteccion `HAS_TURN_SERVER` para control de riesgo de NAT.

## 4. Cambios de configuracion
- `.env.example` con variables VITE para signaling, ASR/MT e ICE.
- `README.md` actualizado para runbook local sin secretos cliente.

## 5. Criterios de aceptacion
- [x] WS de traduccion reintenta automaticamente tras fallo transitorio.
- [x] PeerJS intenta reconexion tras perdida de signaling.
- [x] UI expone estado de red para troubleshooting operativo.
- [x] Configuracion ICE/TURN queda parametrizada por entorno.
- [x] `npm run lint` y `npm run build` en verde.

## 6. Riesgos residuales
- Sin TURN real en produccion, persistira riesgo de fallo en NAT restrictivo.
- Falta validacion manual multi-red (wifi domestica, 4G/5G, red corporativa).
