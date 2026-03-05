# SPEC — security-compliance-and-commercial-continuity (v1)

## 0. Meta
- Feature: security-compliance-and-commercial-continuity
- Version: v1
- Estado: implemented

## 1. Objetivo
Eliminar exposicion de secretos en frontend, exigir sesion autenticada antes de cualquier llamada y registrar consentimiento explicito de grabacion por sesion de llamada.

## 2. Alcance
- Incluye:
  - Sesion autenticada minima (backend firmado + validacion frontend).
  - Traduccion de chat movida a backend (sin API keys en cliente).
  - Registro auditable de consentimiento de grabacion.
  - PeerJS y FontAwesome movidos de CDN a bundle local.
  - Fin de llamada con teardown controlado (sin reload).
- No incluye:
  - SSO corporativo.
  - Persistencia en BD de eventos de consentimiento.

## 3. Cambios en datos
- Se anade log append-only JSONL para eventos de seguridad/compliance en `runtime/audit-log.jsonl` del servicio ASR/MT.

## 4. Cambios en backend
- Servicio: `services/asr-mt/app/main.py`
- Endpoints nuevos:
  - `POST /api/auth/session`
  - `POST /api/auth/validate`
  - `POST /api/chat/translate`
  - `POST /api/sessions/consent`
- Capacidades:
  - Firma HMAC de token de sesion.
  - CORS configurable por `ALLOWED_ORIGINS`.
  - Registro de eventos de sesion y consentimiento.

## 5. Cambios en frontend
- `App.tsx`:
  - Gate de autenticacion previa a llamada.
  - Traduccion de chat via backend.
  - TTS local con Web Speech API (sin proveedor en cliente).
  - Modal de consentimiento antes de grabar.
  - Teardown de llamada sin `window.location.reload()`.
- `constants.ts`:
  - URLs/peer/ICE parametrizadas por variables `VITE_*`.
- `vite.config.ts`:
  - Eliminadas inyecciones `process.env.API_KEY`/`GEMINI_API_KEY`.

## 6. Seguridad y compliance
- 0 secretos en frontend para traduccion/chat/TTS.
- 100% acceso a llamada condicionado a sesion autenticada.
- Consentimiento de grabacion registrado por `call_id`.
- Dependencias criticas de comunicacion (PeerJS) y UI icon set servidas desde bundle.

## 7. Criterios de aceptacion
- [x] No existe `process.env.API_KEY` en frontend.
- [x] Call setup bloqueado si no hay sesion autenticada.
- [x] No se inicia grabacion sin confirmacion de consentimiento.
- [x] Consentimiento se registra por API backend.
- [x] Fin de llamada ejecuta teardown controlado.

## 8. Verificacion minima
- [x] `npm run lint`
- [x] `npm run build`
- [ ] prueba manual llamada 1:1 (pendiente de ejecucion manual)
