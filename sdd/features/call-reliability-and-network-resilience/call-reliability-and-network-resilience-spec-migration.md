# Migration Spec — call-reliability-and-network-resilience

## Objetivo
Migrar de comportamiento best-effort a resiliencia controlada de conexion de llamada y subtitulos.

## Cambios aplicados
- Hook de traduccion con estado de conexion y reconexion automatica.
- App con monitoreo de signaling, avisos de red y bloqueo preventivo cuando signaling esta caido.
- Deteccion explicita de ausencia TURN para visibilidad de riesgo.
- Variables de entorno documentadas en `.env.example`.

## Rollout recomendado
1. Configurar TURN real en `VITE_ICE_SERVERS` (stage/prod).
2. Desplegar peer-server y asr-mt con health checks.
3. Ejecutar smoke test con fallo inducido en signaling y ASR/MT.

## Rollback
- Revertir commit de feature.
- Mantener variables `VITE_*` (son backward compatible).
