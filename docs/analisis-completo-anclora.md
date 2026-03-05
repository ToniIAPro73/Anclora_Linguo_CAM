# Analisis Completo de la Aplicacion (Anclora Private Estates)

## 1) Resumen ejecutivo
La aplicacion tiene una base funcional valida para videollamada 1:1 con subtitulos traducidos en tiempo real y un camino low-cost ya iniciado (microservicio ASR/MT + signaling propio + base TURN).  
Sin embargo, aun no esta lista para un entorno comercial de inversores inmobiliarios por cuatro brechas criticas: seguridad/compliance, fiabilidad en redes reales, continuidad del flujo de negocio (onboarding y cierre), y consistencia de arquitectura de traduccion.

## 2) Objetivo de negocio (marco de evaluacion)
Objetivo principal: permitir reuniones de compra/venta de propiedades entre inversores que no comparten idioma, reduciendo friccion, malentendidos y tiempo de cierre de operaciones.

Criterios tecnicos derivados:
- Alta fiabilidad de llamada (no perder reuniones de alto valor).
- Traduccion suficientemente precisa y estable para negociacion.
- Seguridad y privacidad aptas para conversaciones sensibles.
- UX orientada a negocio (rapida, clara, sin friccion para usuarios no tecnicos).

## 3) Estado actual observado
## Fortalezas
- Modularizacion frontend razonable (`components/`, `hooks/`, `utils/`).
- Pipeline de traduccion streaming separado en `useStreamingTranslation`.
- Instrumentacion basica de red WebRTC (`useWebRtcStats`).
- Infraestructura base low-cost disponible en repo:
  - `services/asr-mt/` (FastAPI WS)
  - `webrtc/peer-server/` (signaling)
  - `infra/turn/` (coturn)
- Build y lint operativos (`npm run lint`, `npm run build` sin errores).

## Riesgos y limitaciones actuales
1. Exposicion de clave de proveedor en cliente (`vite.config.ts` define `process.env.API_KEY`/`GEMINI_API_KEY` en frontend).
2. Dependencia mixta de traduccion:
   - subtitulos por WS ASR/MT,
   - chat/TTS por Gemini directo desde navegador (`App.tsx`).
3. Conectividad WebRTC limitada: `ICE_SERVERS` solo STUN publico (`constants.ts`), sin TURN efectivo por defecto.
4. Configuracion hardcodeada local (`localhost`) para signaling y ASR/MT (`constants.ts`), no preparada para multi-entorno.
5. UX de acceso poco comercial:
   - conexion por `Peer ID` manual,
   - sin salas/enlaces de reunion,
   - sin identidad/rol del participante.
6. Fin de llamada con `window.location.reload()` (`App.tsx`), no hay teardown controlado ni experiencia robusta.
7. Riesgo funcional en grabacion: dependencia de estado `isRecording` dentro de `drawFrame` en `useRecording.ts` puede cortar el loop al iniciar (closure con estado previo).
8. Carga de dependencias criticas por CDN (`index.html`: Tailwind, PeerJS, FontAwesome) con menor control de seguridad/versionado.
9. Sin capa de autenticacion/autorizacion, trazabilidad, consentimiento explicito, ni politicas de retencion.

## 4) Evaluacion del documento `docs/architectura-low-cost.md`
La propuesta low-cost es correcta y coherente con el objetivo (ASR/MT open-source por WS, WebRTC con PeerJS + TURN, VAD, latencia baja).  
El repo ya implementa parte de esa direccion, pero aun de forma parcial:
- Existe servicio ASR/MT, pero por defecto en modo `mock`.
- Existe servidor de signaling, pero cliente sigue en config local fija.
- Existe base TURN, pero sin integracion por defecto en `ICE_SERVERS`.
- Falta cerrar seguridad, despliegue multi-entorno y operacion observables.

## 5) Plan de mejora por fases (ordenado por relevancia)

## Fase 1 (Critica): Seguridad, compliance y continuidad comercial
Objetivo: evitar riesgos legales/comerciales y proteger conversaciones de inversion.

Mejoras:
1. Sacar cualquier uso de API key sensible del frontend y mover llamadas proveedor a backend seguro.
2. Implementar autenticacion de usuarios (agente/inversor), sesiones firmadas y permisos basicos.
3. Definir consentimiento de grabacion + aviso legal + politica de retencion.
4. Eliminar carga de dependencias criticas por CDN en produccion (bundle versionado).

Justificacion:
- Sin esto, existe riesgo de fuga de secretos, incumplimiento y perdida de confianza del cliente premium.

KPI de salida:
- 0 secretos en cliente.
- 100% sesiones autenticadas.
- consentimiento registrado por sesion.

## Fase 2 (Critica): Fiabilidad de llamada y red en escenarios reales
Objetivo: asegurar conectividad estable para reuniones de alto valor.

Mejoras:
1. Configurar TURN productivo y agregarlo a `ICE_SERVERS`.
2. Parametrizar `ASR_MT_WS_URL`, signaling e ICE por entorno (`dev/stage/prod`).
3. Mejorar manejo de errores/reconexion en WS y PeerJS.
4. Sustituir fin de llamada por cierre controlado (sin `reload`).

Justificacion:
- Una reunion fallida implica perdida directa de oportunidad comercial.

KPI de salida:
- tasa de conexion exitosa > 98%.
- caidas por red reducidas de forma medible.
- reconexion automatica en fallos transitorios.

## Fase 3 (Alta): Coherencia de arquitectura de traduccion y coste
Objetivo: consolidar una sola arquitectura operacional y predecible en coste.

Mejoras:
1. Unificar traduccion de subtitulos, chat y TTS bajo backend gestionado.
2. Pasar ASR/MT de `mock` a backend real (`faster-whisper` + `transformers`/Marian/NLLB) con perfiles de calidad.
3. Definir fallback por idioma no soportado y degradacion controlada.
4. Incorporar caching y limites de uso por sesion.

Justificacion:
- Evita doble stack tecnologico, simplifica mantenimiento y mejora previsibilidad de costes.

KPI de salida:
- reduccion de coste por minuto.
- latencia E2E estable para subtitulo parcial/final.
- cobertura de idiomas objetivo de negocio.

## Fase 4 (Alta): UX orientada a closing inmobiliario
Objetivo: reducir friccion en reuniones entre inversores/agentes.

Mejoras:
1. Reemplazar flujo `Peer ID` por enlaces/salas de reunion.
2. Incluir pre-call check (camara/mic/red/idioma) en onboarding.
3. Añadir panel de contexto comercial: idioma detectado, estado de traduccion, calidad de red, resumen de puntos clave.
4. Mejorar accesibilidad y localizacion de la UI.

Justificacion:
- Usuarios de negocio no tecnicos requieren acceso inmediato y confianza operacional.

KPI de salida:
- tiempo de acceso a llamada < 60s.
- menos abandonos en pantalla inicial.
- mayor conversion reunion iniciada -> reunion completada.

## Fase 5 (Media): Calidad tecnica y mantenibilidad
Objetivo: reducir deuda tecnica y acelerar iteraciones seguras.

Mejoras:
1. Corregir riesgo de loop de grabacion en `useRecording`.
2. Completar limpieza de recursos (AudioContext/tracks) al colgar.
3. Añadir pruebas unitarias de hooks criticos y pruebas e2e de flujo de llamada.
4. Separar dominio negocio/comunicacion/traduccion con contratos tipados.

Justificacion:
- Disminuye regresiones en funciones sensibles (traduccion, grabacion, llamada).

KPI de salida:
- reduccion de bugs en produccion.
- cobertura de pruebas minima en modulos criticos.

## Fase 6 (Media): Observabilidad y mejora continua
Objetivo: operar con datos reales, no intuicion.

Mejoras:
1. Telemetria estructurada: latencia ASR/MT, jitter, packet loss, reconexiones.
2. Dashboards y alertas operativas (SLO de llamada y traduccion).
3. Registro de eventos de producto (inicio llamada, abandono, exito de sesion).

Justificacion:
- Permite priorizar mejoras por impacto real en negocio y calidad percibida.

KPI de salida:
- SLO definidos y monitorizados.
- tiempo de deteccion/resolucion de incidencias reducido.

## 6) Prioridad resumida
Orden de ejecucion recomendado:
1. Fase 1 (seguridad/compliance)
2. Fase 2 (fiabilidad red)
3. Fase 3 (arquitectura/coste traduccion)
4. Fase 4 (UX comercial)
5. Fase 5 (mantenibilidad)
6. Fase 6 (observabilidad avanzada)

## 7) Proximo sprint sugerido (2 semanas)
1. Externalizar secretos al backend + auth minima.
2. TURN operativo + configuracion por entorno.
3. Flujo de salas con enlace (sin Peer ID manual).
4. Correccion de teardown de llamada y grabacion.
