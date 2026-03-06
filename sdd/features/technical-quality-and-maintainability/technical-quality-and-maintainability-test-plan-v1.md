# Test Plan — technical-quality-and-maintainability (v1)

## Suite minima obligatoria
- npm run lint
- npm run test
- npm run build
- Prueba manual de llamada 1:1 (audio, video, subtitulos, chat, colgar)

## Casos unitarios
1. Room code normalization
2. Invite link generation
3. Initiator decision
4. Media stream track cleanup

## Caso E2E minimo
1. Levantar frontend + peer-server + ASR/MT mock via `playwright.config.ts`
2. Abrir 2 navegadores headless
3. Autenticar ambos peers, compartir room e iniciar llamada
4. Validar recepcion de subtitulos `chunk_*` en remoto

## Resultado actual
- lint: PASS
- test: PASS (5 tests)
- build: PASS
- e2e playwright: PENDIENTE (requiere runtime con navegadores instalados)
- prueba manual llamada: PENDIENTE
