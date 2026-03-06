# ASR/MT Microservice (FastAPI + WebSocket)

## Objetivo
Servicio de streaming para ASR + traduccion incremental. Recibe PCM 16kHz (mono), devuelve subtitulos parciales y finales via WebSocket.

## Requisitos
- Python 3.10+
- Pip o uv

## Instalacion
```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### Modelos (opcional, para ASR/MT real)
```bash
pip install -r requirements-ml.txt
```

## Ejecutar
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Configuracion (env)
- `ASR_BACKEND` = `mock` (default) o `faster-whisper`
- `MT_BACKEND` = `mock` o `marian`
- `LOG_LEVEL` = `info`
- `ALLOWED_ORIGINS` = lista separada por coma (default `*`)
- `SESSION_SIGNING_KEY` = clave HMAC para tokens de sesion (**obligatoria en prod**)
- `SESSION_TTL_SECONDS` = tiempo de vida de sesion (default `28800`)
- `AUDIT_LOG_PATH` = ruta de log append-only (default `runtime/audit-log.jsonl`)
- `MAX_TRANSLATION_CHARS_PER_SESSION` = cuota de traduccion por sesion (default `20000`)
- `MAX_TTS_CHARS_PER_SESSION` = cuota de TTS por sesion (default `12000`)
- `ROOM_PARTICIPANT_TTL_SECONDS` = TTL de participantes en sala (default `180`)
- `MAX_TELEMETRY_EVENTS_PER_SESSION` = max eventos de telemetria por sesion (default `500`)
- `STORAGE_BACKEND` = `memory` (default) o `sqlite`
- `SQLITE_DB_PATH` = ruta del fichero sqlite (default `runtime/asr-mt.sqlite3`)
- `ASR_MODEL` = `small` (ej. `base`, `small`, `medium`)
- `ASR_DEVICE` = `cpu` (ej. `cuda`)
- `ASR_COMPUTE_TYPE` = `int8` (ej. `float16`)
- `ASR_MIN_CHUNK_MS` = `600`
- `ASR_MAX_BUFFER_MS` = `30000`
- `MT_MODEL` = `Helsinki-NLP/opus-mt-es-en` o `facebook/nllb-200-distilled-600M`
- `MT_DEVICE` = `cpu`
- `MT_MODEL_MAP` = `es-en=Helsinki-NLP/opus-mt-es-en,es-fr=Helsinki-NLP/opus-mt-es-fr`

## Protocolo WebSocket
- URL: `ws://localhost:8001/ws/asr-mt`
- Mensajes JSON: `config`, `end`
- Audio: frames binarios PCM 16-bit LE, 16kHz mono

## Notas
El backend `mock` permite probar la canalizacion sin modelos. Para ASR/MT real usa:
```bash
ASR_BACKEND=faster-whisper MT_BACKEND=transformers MT_MODEL=Helsinki-NLP/opus-mt-es-en \
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Para NLLB usa un modelo NLLB y codigos compatibles (se mapean los idiomas mas comunes).

### Seleccion automatica por par (Marian)
Por defecto, el servicio elige automaticamente modelos Marian para:
`es-en`, `en-es`, `es-fr`, `fr-es`, `es-de`, `de-es`, `es-ru`, `ru-es`.  
Puedes sobrescribir con `MT_MODEL_MAP`.

## API HTTP (seguridad/compliance)

### `POST /api/auth/session`
Genera sesion firmada para acceso a llamada.

Body:
```json
{ "display_name": "Ana Gomez", "role": "agent" }
```

### `POST /api/auth/validate`
Valida token de sesion.

### `POST /api/chat/translate`
Traduce mensajes de chat via backend MT.

### `POST /api/chat/tts`
Unifica flujo de TTS bajo backend: traduce/prepara texto y aplica cuota de TTS por sesion.

### `POST /api/sessions/usage`
Devuelve consumo de sesion para gobernanza de coste (`translated_chars`, `tts_chars`, limites).

### `POST /api/rooms/register`
Registra presencia de peer autenticado en sala.

### `POST /api/rooms/resolve`
Resuelve contraparte e iniciador de llamada en sala.

### `POST /api/telemetry/events`
Ingesta eventos de operacion de llamada/reconexion/precheck.

### `POST /api/telemetry/summary`
Resumen agregado de eventos de operacion por sesion.

Con `STORAGE_BACKEND=sqlite`, rooms y telemetria sobreviven reinicios del servicio.

### `POST /api/sessions/consent`
Registra consentimiento explicito de grabacion por `call_id` en audit log append-only.
