# Migration Spec — translation-architecture-and-cost-governance

## Objetivo
Migrar hacia capa unificada de traduccion/TTS backend-managed con control de coste por sesion.

## Cambios aplicados
- `speakMessage` mueve flujo a backend (`/api/chat/tts`).
- `chat/translate` incorpora cuota y trazabilidad de consumo.
- Nuevo endpoint de consumo de sesion para UI y operacion.

## Rollout recomendado
1. Configurar limites por entorno en `.env*`.
2. Desplegar backend ASR/MT.
3. Verificar translate + tts + usage en cliente.
4. Ajustar limites segun carga real.

## Rollback
- Revertir commit de feature.
- Mantener endpoints nuevos (compatibles) aunque no se usen en frontend.
