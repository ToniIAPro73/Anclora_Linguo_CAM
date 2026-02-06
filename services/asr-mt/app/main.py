from __future__ import annotations

import json
import logging
import os
import time
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from .backends import (
    ASRBackend,
    MTBackend,
    MockASRBackend,
    MockMTBackend,
    SessionConfig,
)


LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("asr-mt")

app = FastAPI(title="ASR/MT Service", version="0.1.0")


class ConfigMessage(BaseModel):
    type: str
    session_id: str
    source_lang: str
    target_lang: str
    sample_rate: int = 16000
    format: str = "s16le"


class EndMessage(BaseModel):
    type: str


def build_asr_backend() -> ASRBackend:
    backend = os.getenv("ASR_BACKEND", "mock").lower()
    if backend == "mock":
        return MockASRBackend()
    if backend == "faster-whisper":
        from .backends import FasterWhisperASRBackend
        return FasterWhisperASRBackend()
    raise ValueError(f"Unsupported ASR backend: {backend}")


def build_mt_backend() -> MTBackend:
    backend = os.getenv("MT_BACKEND", "mock").lower()
    if backend == "mock":
        return MockMTBackend()
    if backend in {"transformers", "marian", "nllb"}:
        from .backends import TransformersMTBackend
        return TransformersMTBackend()
    raise ValueError(f"Unsupported MT backend: {backend}")


@app.websocket("/ws/asr-mt")
async def ws_asr_mt(websocket: WebSocket) -> None:
    await websocket.accept()
    asr_backend = build_asr_backend()
    mt_backend = build_mt_backend()
    session_config: Optional[SessionConfig] = None

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect

            if "text" in message:
                await handle_text_message(
                    websocket, message["text"], asr_backend, mt_backend, lambda: session_config
                )
                if session_config is None and message["text"]:
                    try:
                        parsed = ConfigMessage.model_validate_json(message["text"])
                        session_config = SessionConfig(
                            session_id=parsed.session_id,
                            source_lang=parsed.source_lang,
                            target_lang=parsed.target_lang,
                            sample_rate=parsed.sample_rate,
                            format=parsed.format,
                        )
                        asr_backend.start(session_config)
                        logger.info("Session %s started", session_config.session_id)
                    except ValidationError:
                        pass
                continue

            if "bytes" in message:
                if session_config is None:
                    await websocket.send_text(json.dumps({"type": "error", "message": "missing config"}))
                    continue
                audio_bytes = message["bytes"]
                partial = asr_backend.transcribe_chunk(audio_bytes)
                if partial:
                    translated = mt_backend.translate(
                        partial, session_config.source_lang, session_config.target_lang
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "partial",
                                "text": partial,
                                "translated_text": translated,
                                "timestamp_ms": int(time.time() * 1000),
                            }
                        )
                    )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")


async def handle_text_message(
    websocket: WebSocket,
    text: str,
    asr_backend: ASRBackend,
    mt_backend: MTBackend,
    config_provider,
) -> None:
    if not text:
        return
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        await websocket.send_text(json.dumps({"type": "error", "message": "invalid json"}))
        return

    msg_type = payload.get("type")
    if msg_type == "config":
        await websocket.send_text(json.dumps({"type": "ok", "message": "config received"}))
        return
    if msg_type == "end":
        final = asr_backend.finalize()
        session_config = config_provider()
        if final and session_config:
            translated = mt_backend.translate(
                final, session_config.source_lang, session_config.target_lang
            )
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "final",
                        "text": final,
                        "translated_text": translated,
                        "timestamp_ms": int(time.time() * 1000),
                    }
                )
            )
        await websocket.close()
        return

    await websocket.send_text(json.dumps({"type": "error", "message": "unknown message"}))
