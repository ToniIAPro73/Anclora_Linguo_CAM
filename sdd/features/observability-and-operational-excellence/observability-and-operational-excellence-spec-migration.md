# Migration Spec — observability-and-operational-excellence

## Objetivo
Añadir capa de observabilidad operativa sin romper flujo de llamada ni traduccion.

## Cambios aplicados
- Backend con endpoints de telemetria y resumen.
- Frontend instrumentado en eventos criticos de experiencia de llamada.
- Variables de entorno para controlar retention volumetrica por sesion.

## Rollout recomendado
1. Desplegar backend con nuevos endpoints.
2. Validar envio de eventos desde frontend en stage.
3. Ajustar limites de eventos y estrategia de exportado si crece volumen.

## Rollback
- Revertir commit de feature.
- Endpoints extra pueden permanecer sin uso (compatibles).
