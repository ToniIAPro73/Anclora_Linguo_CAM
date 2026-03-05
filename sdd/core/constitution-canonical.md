# CONSTITUCION TECNICA — ANCLORA LINGUO CAM
## Norma suprema de gobernanza de videollamada y traduccion en tiempo real
### Version 1.0.0 — 2026-03-05

## PREAMBULO
Esta constitucion define las reglas inviolables para operar Anclora Linguo CAM en escenarios de negociacion inmobiliaria multilingue. Ninguna implementacion, prompt o feature puede contradecir este documento.

## TITULO I — REGLAS DE ORO
1. Fiabilidad primero: toda decision tecnica debe preservar continuidad de llamada.
2. Comprension mutua: la traduccion debe priorizar claridad y estabilidad sobre efectos cosmeticos.
3. Privacidad por defecto: cero secretos en cliente y minimizacion de datos sensibles.
4. Reversibilidad operativa: toda accion de automatizacion critica debe poder rehacerse o revertirse.
5. Observabilidad accionable: sin telemetria basica de llamada/traduccion no hay GO de produccion.

## TITULO II — PRINCIPIOS RECTORES
- Fail-safe over fail-open en audio/video/traduccion.
- Configuracion por entorno, nunca hardcode local en codigo de negocio.
- Contratos tipados entre frontend y servicios realtime.
- UX comercial: acceso rapido, bajo esfuerzo y baja friccion para cerrar operaciones.

## TITULO III — PROHIBICIONES
- Prohibido exponer API keys del proveedor IA en navegador.
- Prohibido depender exclusivamente de STUN en produccion sin TURN.
- Prohibido romper compatibilidad de flujo de llamada 1:1 sin plan de migracion.
- Prohibido introducir cambios sin validacion minima (`lint`, `build`, prueba manual 1:1).
