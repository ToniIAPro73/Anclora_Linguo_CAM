# Mejoras y Plan de Implementacion (Low/Zero Cost)

## Objetivo
Reducir costos de ejecucion y dependencia de APIs pagas, manteniendo subtitulos en vivo con baja latencia. Priorizar stack open source y opciones zero/low cost, con un plan incremental.

## Mejoras detectadas (priorizadas)
1. **Dependencia de Gemini Live y API key expuesta**: coste por uso y riesgo de fuga.
2. **Latencia por `ScriptProcessorNode`**: buffers grandes y API deprecada.
3. **WebRTC sin TURN propio**: fallos de conexion en redes NAT restrictivas.
4. **Sin VAD ni AEC**: mayor ruido y envio innecesario de audio.
5. **Arquitectura monolitica en `App.tsx`**: dificulta mantener y optimizar.
6. **Observabilidad baja**: sin metricas de latencia, WER, o calidad de red.

## Alternativas open source / low cost

### Opcion A: Local (cliente) con modelos ligeros
- **ASR**: `whisper.cpp` o `faster-whisper` via WebAssembly/WebGPU.
- **MT**: `argos-translate` (offline), o `MarianMT` quantizado en WebGPU.
- **TTS** (opcional): `piper` (coqui) local.
Ventajas: coste cero por uso, privacidad alta.  
Riesgos: rendimiento variable segun hardware del usuario.

### Opcion B: Edge server low-cost
- **ASR**: `faster-whisper` (CTranslate2) en CPU con quantizacion.
- **MT**: `NLLB-200` o `M2M100` quantizados; alternativa ligera `MarianMT`.
- **VAD**: `silero-vad`.
Ventajas: control de latencia y calidad, costos bajos en VPS.  
Riesgos: requiere infraestructura y mantenimiento.

### Opcion C: Hibrido
- Cliente usa VAD + captura, servidor usa ASR/MT.
- Permite mover carga pesada fuera del navegador.

## Plan paso a paso (con justificacion)

### Fase 1 - Medicion y estabilidad basica
1. **Agregar metricas de latencia** (ASR chunk, MT, total).  
   Justificacion: sin datos no se pueden optimizar retrasos.
2. **Registrar eventos de WebRTC** (ICE, bitrate, packet loss).  
   Justificacion: entender fallos en red y calidad de llamada.
3. **Separar modulos**: `webrtc/`, `translation/`, `ui/`.  
   Justificacion: facilita iteraciones sin romper el flujo principal.

### Fase 2 - Audio pipeline de baja latencia
1. **Migrar a AudioWorklet** con buffers 128-512 frames.  
   Justificacion: reduce latencia vs `ScriptProcessorNode`.
2. **Configurar `getUserMedia`** con `echoCancellation`, `noiseSuppression`.  
   Justificacion: mejora la entrada para ASR.
3. **Incorporar VAD** (silero o web-vad) para cortar silencio.  
   Justificacion: reduce trafico y coste de inferencia.

### Fase 3 - Infra WebRTC fiable
1. **Agregar STUN/TURN propio** (coturn).  
   Justificacion: aumenta tasa de conexion en redes NAT.
2. **Reemplazar signaling publico** por servidor PeerJS propio.  
   Justificacion: control y menor dependencia externa.

### Fase 4 - Sustituir Gemini Live por stack open source
1. **Definir ruta A o B** (local o edge).  
   Justificacion: balance entre coste y rendimiento.
2. **Implementar ASR streaming** con `faster-whisper` + VAD.  
   Justificacion: entrega transcripciones parciales en vivo.
3. **Implementar MT** con `NLLB-200` quantizado o `MarianMT`.  
   Justificacion: traduccion offline y control de costos.
4. **Exponer API de streaming** (WebSocket) para subtitulos.  
   Justificacion: canal eficiente para texto en tiempo real.

### Fase 5 - UX y calidad percibida
1. **Mostrar estado de latencia** y calidad de red.  
   Justificacion: confianza del usuario.
2. **Buffer adaptativo** segun latencia/packet loss.  
   Justificacion: reduce cortes en subtitulos.
3. **Modo "low bandwidth"** para video o solo audio.  
   Justificacion: mas robustez en redes lentas.

## Propuesta de arquitectura low-cost (resumen)
- **Cliente**: WebRTC para llamada; AudioWorklet + VAD local; envia audio al servidor de ASR/MT.
- **Servidor**: WebSocket streaming, `faster-whisper` (ASR) + `MarianMT/NLLB` (MT).
- **Infra**: PeerJS signaling propio + coturn.
- **Costo**: VPS con CPU potente y modelos quantizados; escalable por sala.

## Estado por fases (actual)
- Fase 1: parcial (metricas basicas WebRTC + hooks `useWebRtcStats`/`useStreamingTranslation`/`useRecording`; UI separada en `CallHeader`, `CallSetup`, `ChatSidebar`, `VideoGrid`, `ControlBar`; falta separar Settings modal si se desea).
- Fase 2: parcial (AudioWorklet + VAD simple y `getUserMedia` con AEC/NS; falta ajuste fino de buffers).
- Fase 3: base creada (configuracion de PeerJS y coturn en repo).
- Fase 4: parcial (microservicio WS + cliente integrado; falta ASR/MT real).
- Fase 5: pendiente (UX y adaptacion de buffers por implementar).

## Entregables generados (en este repo)
- `docs/architectura-low-cost.md`: diagrama y APIs.
- `services/asr-mt/`: microservicio Python (FastAPI + WebSocket) base.
- `webrtc/peer-server/`: servidor de signaling PeerJS base.
- `infra/turn/`: configuracion base de coturn.
