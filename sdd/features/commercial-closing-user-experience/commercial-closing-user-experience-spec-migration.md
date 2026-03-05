# Migration Spec — commercial-closing-user-experience

## Objetivo
Migrar de onboarding tecnico basado en Peer ID manual hacia onboarding comercial basado en sala/enlace.

## Cambios aplicados
- Setup de llamada orientado a room link.
- Backend con registro/resolve de participantes por sala.
- Pre-check para reducir fallos al inicio de sesion.

## Rollout recomendado
1. Desplegar backend con endpoints de room/health.
2. Verificar flujo `?room=` en frontend.
3. Entrenar equipo comercial en flujo de enlace de sala.

## Rollback
- Revertir commit de feature.
- Mantener endpoints room sin uso (compatibles).
