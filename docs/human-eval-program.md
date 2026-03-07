# Human Evaluation Program (ASR/MT) - Anclora LinguoCAM

## Objetivo
Definir una evaluacion humana repetible para calidad percibida de subtitulos traducidos y comprension mutua en llamada real.

## Alcance
- Modalidad: 1:1 (agente/inversor), web movil y escritorio.
- Idiomas iniciales: `es<->en` (extensible a `es<->fr`, `es<->de`).
- Escenarios: red buena, red media, red degradada.

## Muestra minima
- 20 clips por par de idiomas (30-60s cada clip).
- Al menos 5 hablantes distintos y 2 acentos por idioma.
- 2 condiciones de ruido: silencioso y ruido ambiente moderado.

## Criterios de evaluacion
- Adequacy (1-5): fidelidad semantica de la traduccion.
- Fluency (1-5): naturalidad gramatical del subtitulo traducido.
- Caption stability (1-5): ausencia de parpadeo/reescrituras molestas.
- Comprehension success (0/1): el receptor entendio correctamente la accion/mensaje.

## Protocolo
1. Ejecutar llamada A/B con fixture de audio o voz real.
2. Capturar transcript exportado (VTT/SRT) y resumen telemetry (`/api/telemetry/summary` y `/api/telemetry/slo`).
3. Puntuar cada clip por 2 evaluadores independientes.
4. Resolver discrepancias >1 punto con un tercer evaluador.
5. Consolidar media por criterio y por par de idiomas.

## Gate de release recomendado
- Adequacy media >= 4.0
- Fluency media >= 4.0
- Caption stability media >= 3.8
- Comprehension success >= 90%
- SLO tecnico (telemetry):
  - TTFC p95 <= 1500 ms
  - Caption lag p95 <= 1800 ms

## Plantilla de resultados (CSV)
Columnas minimas:
`clip_id,source_lang,target_lang,condition,adequacy,fluency,stability,comprehension_ok,evaluator,notes`

## Cadencia
- Smoke semanal: 10 clips
- Release candidate: set completo (20+ clips/par)
- Post-release: muestreo mensual
