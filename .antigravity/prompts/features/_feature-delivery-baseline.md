# BASELINE OBLIGATORIO DE ENTREGA (A/B/C/D)

Uso obligatorio:
- Referenciar este baseline en cualquier entrega de feature.
- Este baseline aplica desde inicio de implementacion, no solo en QA.

## 1) Entorno y configuracion (obligatorio)
- Leer `.env` y `.env.local` (si existe) antes de implementar.
- No hardcodear URLs de signaling, ASR/MT, TURN ni claves.
- Configurar variables por entorno (`dev`, `stage`, `prod`).

## 2) Flujo de llamada activa (obligatorio)
- No romper: audio, video, subtitulos, chat, colgar.
- Si la feature afecta llamada, incluir prueba manual 1:1.
- Liberar recursos (tracks, peer, audio contexts, workers) al finalizar.

## 3) Reglas WebRTC y traduccion
- Validar ICE con STUN+TURN cuando aplique.
- Mantener reconexion para fallos transitorios.
- Medir impacto en latencia percibida de subtitulos.

## 4) Reglas UX/UI obligatorias
- Compatibilidad movil y escritorio.
- Evitar solapes/overflow y estados de UI ambiguos.
- No introducir dependencias criticas via CDN en produccion.

## 5) Criterios NO-GO automatico
- `SECRET_EXPOSED_FRONTEND`
- `TURN_NOT_CONFIGURED`
- `CALL_FLOW_REGRESSION_P0`
- `SUBTITLE_LATENCY_REGRESSION_P0`
- `MOBILE_DESKTOP_UI_BREAK`

## 6) Higiene de pruebas
- Eliminar scripts temporales de debug antes de cerrar la iteracion.
