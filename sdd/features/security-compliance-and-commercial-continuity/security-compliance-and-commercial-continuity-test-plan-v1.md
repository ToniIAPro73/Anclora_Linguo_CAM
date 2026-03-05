# Test Plan — security-compliance-and-commercial-continuity (v1)

## Suite minima obligatoria
- npm run lint
- npm run build
- Prueba manual llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos funcionales
1. Login session
- Dado que no hay sesion local,
- cuando se abre la app,
- entonces se muestra pantalla de autenticacion y no permite iniciar llamada.

2. Chat translation via backend
- Dado mensaje en chat,
- cuando se pulsa traducir,
- entonces frontend invoca `/api/chat/translate` con token y renderiza `translatedText`.

3. Recording consent gate
- Dado llamada activa,
- cuando se pulsa grabar sin consentimiento,
- entonces se muestra modal de consentimiento.
- Cuando se confirma,
- entonces se registra `/api/sessions/consent` y empieza grabacion.

4. Controlled call teardown
- Dado llamada activa,
- cuando se cuelga,
- entonces se paran tracks, sockets, streaming y estado vuelve a `IDLE` sin recargar pagina.

## Resultado actual
- lint: PASS
- build: PASS
- manual call e2e: PENDIENTE
