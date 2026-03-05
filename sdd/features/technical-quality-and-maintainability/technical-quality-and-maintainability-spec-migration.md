# Migration Spec — technical-quality-and-maintainability

## Objetivo
Endurecer estabilidad del flujo de llamada y reducir deuda mediante refactor controlado + tests.

## Cambios aplicados
- Hook `useRecording` robustecido para evitar bug de closure.
- Desacople de logica de sesion de llamada en utilidades testeables.
- Agregada base de pruebas unitarias en Vitest.

## Rollout recomendado
1. Desplegar frontend.
2. Ejecutar smoke test de grabacion start/stop repetido.
3. Confirmar ausencia de leaks de tracks/context en sesiones largas.

## Rollback
- Revertir commit de feature.
