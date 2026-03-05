---
trigger: always_on
---

# Feature Rules: Call Reliability and Network Resilience

## Normative priority
1) `sdd/core/constitution-canonical.md`
2) `.agent/rules/workspace-governance.md`
3) `sdd/features/call-reliability-and-network-resilience/call-reliability-and-network-resilience-spec-v1.md`

## Immutable rules
- ICE debe soportar STUN + TURN operativo.
- Reconexion automatica para fallos transitorios en signaling y ASR/MT WS.
- Teardown de llamada debe liberar recursos de forma controlada.
- Configuracion de red debe depender de entorno, no de hardcodes.
