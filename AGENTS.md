# AGENTS.md

## Contexto del producto
- Este repositorio implementa una app de videollamadas con traduccion en tiempo real.
- Objetivo de negocio: conectar inversores inmobiliarios que compran o venden propiedades mediante **Anclora Private Estates**, sin friccion por idioma.
- Toda decision tecnica debe priorizar: fiabilidad de llamada, comprension mutua, privacidad y rapidez de cierre comercial.

## Estructura del proyecto
- Frontend (Vite + React + TypeScript):
  - `App.tsx`: orquestacion principal de llamada, subtitulos, chat, controles y estados.
  - `components/`: UI modular (`CallSetup`, `VideoGrid`, `ChatSidebar`, `ControlBar`, etc.).
  - `hooks/`: logica reusable (`useStreamingTranslation`, `useRecording`, `useWebRtcStats`).
  - `utils/`: utilidades de audio y metricas WebRTC.
  - `constants.ts`, `types.ts`: configuracion y tipos compartidos.
  - `audio-worklet-processor.js`: procesamiento de audio (PCM + VAD simple) en AudioWorklet.
- Infra/servicios:
  - `services/asr-mt/`: microservicio FastAPI WebSocket para ASR/MT (mock + backends reales).
  - `webrtc/peer-server/`: servidor PeerJS de signaling.
  - `infra/turn/`: configuracion base para coturn (TURN/STUN).
- Documentacion:
  - `docs/architectura-low-cost.md`: propuesta low-cost de arquitectura.

## Comandos de desarrollo
- `npm install`: instala dependencias frontend.
- `npm run dev`: inicia Vite en local.
- `npm run lint`: validacion estatica con ESLint.
- `npm run test`: ejecuta Vitest (actualmente sin suites o con suites minimas).
- `npm run build`: build de produccion en `dist/`.
- `npm run preview`: previsualiza build local.

## Convenciones de codigo
- React funcional con hooks; evitar componentes clase.
- Sangria de 2 espacios.
- Nombres:
  - `PascalCase`: componentes, interfaces/types.
  - `camelCase`: variables, funciones, hooks internos.
  - `UPPER_SNAKE_CASE`: constantes globales.
- Mantener cambios pequenos, acotados y consistentes con el estilo existente.

## Guia de cambios
- Antes de modificar:
  - revisar impacto en flujo de llamada activa (audio/video/subtitulos/chat).
  - validar que no se rompe UX en movil y escritorio.
- Al modificar logica de audio/traduccion:
  - verificar latencia percibida, cortes de subtitulos y consumo de red.
- Al modificar WebRTC:
  - considerar ICE, NAT traversal, degradacion de red y fallback.

## Testing y validacion minima
- No hay cobertura amplia automatizada hoy.
- Validacion minima obligatoria para cambios funcionales:
  - `npm run lint`
  - `npm run build`
  - prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar).
- Si se agregan pruebas:
  - preferir `*.test.ts`/`*.test.tsx` colocalizados o en `tests/`.
  - documentar comando y alcance en `README.md`.

## Seguridad y configuracion
- Nunca commitear secretos.
- Variables sensibles en `.env.local`.
- El proyecto usa `GEMINI_API_KEY` para funcionalidades Gemini.
- Para produccion:
  - preferir `wss/https`.
  - desplegar TURN propio y signaling propio.
  - eliminar dependencias criticas cargadas por CDN si impactan seguridad/compliance.

## Git y PRs
- Convencional Commits recomendados:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `chore(scope): ...`
- PRs deben incluir:
  - resumen breve de cambios.
  - pasos de verificacion.
  - evidencia visual si hay cambios UI.
  - impacto esperado en latencia/estabilidad/coste (si aplica).
