# Analisis y Arquitectura de LinguoCam

## Resumen del producto
LinguoCam es una aplicacion web que habilita llamadas de video P2P con subtitulos traducidos en tiempo real. Cada participante habla en su idioma, y la app genera subtitulos traducidos para el otro participante con baja latencia. El proyecto esta construido con React + Vite y usa WebRTC via PeerJS para la llamada, y Gemini Live para ASR/MT en streaming.

## Objetivos funcionales
- Llamada de video 1:1 entre pares.
- Subtitulos en vivo traducidos en el idioma del otro participante.
- Baja latencia percibida (subtitulos casi en paralelo al audio).
- Modo Push-To-Talk (PTT) o manos libres.
- Chat lateral con mensajes y traduccion puntual.
- Grabacion local combinando ambos videos y audio.

## Componentes principales
- UI Web (React): `App.tsx` concentra la logica de llamada, subtitulos, chat, controles y grabacion.
- WebRTC P2P: PeerJS (CDN) se encarga del signaling y la conexion de medios entre pares.
- Canal de datos: PeerJS data channel para chat y envio de subtitulos traducidos.
- Motor de traduccion: `@google/genai` Live API para ASR y traduccion streaming.
- Audio utils: `utils/audioUtils.ts` para codificar audio PCM a base64 y decodificar audio TTS.

## Estructura del proyecto
- `index.html` carga Tailwind CDN, PeerJS CDN y FontAwesome; define estilos globales.
- `index.tsx` monta React y renderiza `App`.
- `App.tsx` contiene la mayor parte del comportamiento (estado, WebRTC, Gemini Live, UI).
- `constants.ts` define idiomas soportados, modelo, sample rates.
- `utils/audioUtils.ts` provee helpers de audio y base64.

## Flujo de datos (alto nivel)
1. Usuario A inicia llamada a B via PeerJS.
2. Se establece canal de medios (audio/video) y data channel.
3. El audio local se captura y se envia a Gemini Live cuando PTT o manos libres estan activos.
4. Gemini Live retorna transcripcion traducida (texto).
5. La app muestra subtitulos locales y los envia al peer via data channel.
6. El peer renderiza los subtitulos recibidos como "remoteSubtitle".

## Secuencias clave

### Inicio de llamada
- `initiateCall()` obtiene `getUserMedia`, crea llamada PeerJS, abre data channel y ejecuta `handleCall()`.
- `handleCall()` asigna el stream remoto al video, y arranca `startGeminiTranslation()`.

### Traduccion en vivo
- `startGeminiTranslation()` crea un `AudioContext` a 16kHz.
- Se usa `createScriptProcessor(4096)` para capturar audio.
- Si PTT/manos libres estan activos, se codifica el buffer PCM a base64 y se envia a Gemini Live.
- El callback `onmessage` recibe `outputTranscription`, se actualizan subtitulos y se envian al peer.

### Chat y TTS
- `sendChatMessage()` envia texto por data channel.
- `translateMessage()` usa Gemini para traducir mensajes.
- `speakMessage()` usa Gemini TTS y reproduce audio local.

### Grabacion
- Se crea un canvas 1280x720 con compositing de ambos videos.
- Se mezclan audio local y remoto en un `MediaStreamDestination`.
- `MediaRecorder` genera un WebM para descarga local.

## Dependencias y servicios externos
- PeerJS CDN: signaling y WebRTC; por defecto usa un servidor publico de PeerJS.
- Gemini Live API: transcripcion y traduccion en streaming.
- Tailwind CDN y FontAwesome CDN para UI.

## Configuracion y secretos
- `vite.config.ts` inyecta `process.env.API_KEY` desde `GEMINI_API_KEY`.
- `.env.local` debe contener `GEMINI_API_KEY`.
- El API key queda expuesto en el frontend (no hay backend propio).

## Consideraciones de latencia
- `ScriptProcessorNode` con buffer 4096 a 16kHz agrega ~256ms por chunk.
- No hay VAD dedicado ni AEC/NS configurados en `getUserMedia`.
- El uso de un servidor PeerJS publico y ausencia de TURN puede impactar la conexion y la latencia.

## Riesgos y limitaciones actuales
- Dependencia de Gemini Live (coste y disponibilidad).
- Exposicion del API key en cliente.
- Sin TURN: llamadas pueden fallar en redes restrictivas.
- `ScriptProcessorNode` esta deprecado (debe migrar a AudioWorklet).
- No hay manejo robusto de reconexion, fallos o metrics de calidad.
- `FRAME_RATE` y `JPEG_QUALITY` existen pero no se usan claramente en el flujo actual.

## Oportunidades de mejora (resumen)
- Migrar a una arquitectura low-cost con ASR/MT open source.
- Mejorar pipeline de audio (VAD, AudioWorklet, buffers pequenos).
- Infra WebRTC propia con STUN/TURN.
- Separar logica en modulos para mantenibilidad.

