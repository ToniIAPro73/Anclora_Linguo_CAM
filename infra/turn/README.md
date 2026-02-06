# TURN (coturn) Base Config

## Objetivo
Habilitar conectividad WebRTC en redes restrictivas via TURN.

## Requisitos
- coturn instalado en el servidor

## Configuracion
- Edita `turnserver.conf` con tu dominio, IP publica y credenciales.
- Usa TLS en produccion.

## Ejecutar
```bash
turnserver -c ./turnserver.conf
```
