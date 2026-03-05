---
trigger: always_on
---

# Feature Rules: Technical Quality and Maintainability

## Normative priority
1) `sdd/core/constitution-canonical.md`
2) `.agent/rules/workspace-governance.md`
3) `sdd/features/technical-quality-and-maintainability/technical-quality-and-maintainability-spec-v1.md`

## Immutable rules
- Corregir riesgos funcionales en hooks criticos antes de nuevas capas complejas.
- Toda limpieza de recursos multimedia debe ser verificable en teardown.
- Tests minimos obligatorios en hooks y flujo principal.
- Deuda tecnica debe reducirse sin comprometer estabilidad de llamada.
