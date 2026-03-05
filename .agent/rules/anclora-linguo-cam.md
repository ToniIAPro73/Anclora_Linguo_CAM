---
trigger: always_on
---

# Anclora Linguo CAM — Workspace Rules

## Identidad del producto
Anclora Linguo CAM es la plataforma de videollamada 1:1 con traduccion en tiempo real para cerrar operaciones inmobiliarias entre inversores y agentes sin friccion por idioma.

## Jerarquia normativa
1. `sdd/core/constitution-canonical.md`
2. `.agent/rules/workspace-governance.md`
3. `sdd/core/product-spec-v0.md`
4. `sdd/core/spec-core-v1.md`
5. `sdd/features/<feature>/<feature>-spec-vX.md`

Si hay conflicto: gana el documento de mayor prioridad.

## Reglas inmutables
1. Nunca exponer secretos o API keys en frontend.
2. Toda feature debe proteger fiabilidad de llamada, comprension mutua, privacidad y velocidad de cierre.
3. No romper flujo base de llamada activa: audio, video, subtitulos, chat y colgar.
4. Ningun cambio WebRTC sin considerar ICE, NAT traversal, TURN y degradacion de red.
5. Toda UI nueva debe funcionar en movil y escritorio.
6. Toda decision de arquitectura de traduccion debe minimizar latencia y coste operativo.
7. No hardcodear endpoints de entorno (`localhost`, URLs de staging/prod) en codigo funcional.
8. No introducir dependencias criticas por CDN en produccion.

## Stack vigente
- Frontend: Vite + React + TypeScript
- Realtime: WebRTC + PeerJS signaling
- Traduccion streaming: FastAPI WebSocket (`services/asr-mt`)
- Infra red: TURN/STUN (`infra/turn`)

## Criterio de entrega
Cada entrega de feature debe incluir:
- Especificacion SDD de la feature.
- Implementacion minima viable.
- Verificacion tecnica (`npm run lint`, `npm run build`).
- Validacion manual de llamada 1:1 (audio, video, subtitulos, chat, colgar).
