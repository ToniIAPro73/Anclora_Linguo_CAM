---
trigger: always_on
---

# Workspace Governance — Anclora Linguo CAM (SDD v1)

## Jerarquia normativa (orden de prioridad)
1. `sdd/core/constitution-canonical.md` (NORMA SUPREMA)
2. `sdd/core/product-spec-v0.md` (producto)
3. `sdd/core/spec-core-v1.md` (arquitectura)
4. `sdd/features/<feature>/<feature>-spec-vX.md` (scope por feature)
5. `.agent/skills/**/SKILL.md` (instrucciones operativas)
6. `.antigravity/prompts/**.md` (prompts de ejecucion)

## Regla core vs feature
- El core no se altera sin versionado.
- Toda feature nueva vive en `sdd/features/<feature>/`.
- Si una feature requiere cambiar core:
  - crear nueva version de spec core,
  - registrar el cambio en `sdd/core/CHANGELOG.md`.

## Reglas anti-conflicto
- Nunca reescribir versiones previas de specs: versionar (`v1`, `v2`, ...).
- Nunca mezclar reglas globales con reglas particulares de una feature.
- Nunca desactivar validaciones de seguridad para acelerar una entrega.
- Nunca sustituir teardown controlado por `window.location.reload()` en flujo de llamada.

## Baseline obligatorio para delivery y QA
- Referencia de entrega: `.antigravity/prompts/features/_feature-delivery-baseline.md`.
- Referencia QA/Gate: `.antigravity/prompts/features/_qa-gate-baseline.md`.

## Criterios NO-GO
- `SECRET_EXPOSED_FRONTEND`
- `TURN_NOT_CONFIGURED`
- `ENV_CONFIG_HARDCODED`
- `CALL_FLOW_REGRESSION_P0`
- `SUBTITLE_LATENCY_REGRESSION_P0`
- `MOBILE_DESKTOP_UI_BREAK`
- `TEST_ARTIFACTS_NOT_CLEANED`
