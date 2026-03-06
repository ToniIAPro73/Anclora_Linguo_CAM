# Test Plan — commercial-closing-user-experience (v1)

## Suite minima obligatoria
- npm run lint
- npm run build
- Prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos funcionales
1. Enlace de sala
- Usuario A copia enlace de sala.
- Usuario B abre enlace (`?room=`) y se precarga sala.

2. Resolucion de participantes
- Ambos usuarios pulsan iniciar llamada.
- El iniciador marca y el otro recibe llamada.
- Validar `time_to_pair_ms` y `attempts` en evento `room_pair_resolved`.

3. Pre-check
- Pulsar pre-check antes de llamar.
- Mostrar resultado inline OK/error.

## Resultado actual
- lint: PASS
- build: PASS
- validacion manual 2 navegadores: PENDIENTE
