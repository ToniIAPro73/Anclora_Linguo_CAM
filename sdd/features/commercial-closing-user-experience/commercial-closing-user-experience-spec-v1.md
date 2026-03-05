# SPEC — commercial-closing-user-experience (v1)

## 0. Meta
- Feature: commercial-closing-user-experience
- Version: v1
- Estado: implemented

## 1. Objetivo
Reducir friccion de acceso a llamada para perfiles no tecnicos usando salas por enlace y validacion previa de dispositivos/red.

## 2. Alcance
- Incluye:
  - flujo de sala por codigo/enlace,
  - registro y resolucion de participantes en backend,
  - pre-call check de camara, microfono, red y backend,
  - flujo de llamada iniciada automaticamente por el participante iniciador de sala.
- No incluye:
  - persistencia de salas en base de datos,
  - invitaciones por email/whatsapp automaticas.

## 3. Cambios backend
- `services/asr-mt/app/main.py`
  - `GET /health`
  - `POST /api/rooms/register`
  - `POST /api/rooms/resolve`
  - TTL de participantes en sala por `ROOM_PARTICIPANT_TTL_SECONDS`.

## 4. Cambios frontend
- `App.tsx`
  - soporte `?room=` en URL.
  - registro/polling de sala para encontrar counterpart.
  - determinacion de iniciador para evitar doble marcado.
  - pre-check de dispositivos/red desde setup.
- `components/CallSetup.tsx`
  - boton copiar enlace de invitacion.
  - boton pre-check y estado inline.

## 5. Criterios de aceptacion
- [x] No se requiere intercambio manual de Peer ID para conectar.
- [x] Existe enlace compartible de sala.
- [x] Existe pre-check operativo previo a llamada.
- [x] `npm run lint` y `npm run build` en verde.
