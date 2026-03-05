# Migration Spec — security-compliance-and-commercial-continuity

## Objetivo
Migrar de cliente con API key expuesta a arquitectura con backend como frontera de seguridad.

## Cambios aplicados
- Eliminado uso de `process.env.API_KEY` en frontend.
- Eliminada inyeccion de secret en `vite.config.ts`.
- Dependencias PeerJS/FontAwesome movidas de CDN a npm bundle.
- Anadidos endpoints de auth/session y consentimiento en ASR/MT service.

## Rollout recomendado
1. Desplegar backend ASR/MT con nuevas rutas y `SESSION_SIGNING_KEY` fuerte.
2. Configurar frontend con `VITE_ASR_MT_HTTP_URL` y `VITE_ASR_MT_WS_URL`.
3. Verificar login + llamada + traduccion de chat + consentimiento grabacion.

## Rollback
- Revertir deploy frontend a commit previo.
- Mantener backend nuevo compatible (no rompe WS existente).
