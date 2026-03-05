# Product Spec v0 — Anclora Linguo CAM

## 1. Objetivo de negocio
Permitir reuniones de compra/venta de propiedades entre inversores y agentes que no comparten idioma, reduciendo friccion, malentendidos y tiempo de cierre.

## 2. Objetivos tecnicos
- Alta fiabilidad de llamada.
- Traduccion estable y util para negociacion.
- Seguridad y privacidad aptas para conversaciones sensibles.
- UX orientada a negocio, no tecnica.

## 3. Flujo funcional v0
- Setup de llamada 1:1.
- Conexion WebRTC con audio/video.
- Subtitulos traducidos en tiempo real.
- Chat contextual durante llamada.
- Finalizacion de llamada con limpieza de recursos.

## 4. Restricciones y no-objetivos v0
- Sin hardcodes de endpoints locales para produccion.
- Sin secretos cliente-side.
- Sin dependencias criticas por CDN en produccion.

## 5. Criterio de exito operativo
- Conexion exitosa de llamada > 98% (objetivo).
- Latencia de subtitulos estable y usable en negociacion.
- Time-to-call bajo para usuarios no tecnicos.
