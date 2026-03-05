from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_SIGNING_KEY = os.getenv("SESSION_SIGNING_KEY", "change-me-in-production")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "28800"))
AUDIT_LOG_PATH = Path(os.getenv("AUDIT_LOG_PATH", "runtime/audit-log.jsonl"))


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign_payload(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(SESSION_SIGNING_KEY.encode("utf-8"), serialized, hashlib.sha256).digest()
    return f"{_b64url(serialized)}.{_b64url(signature)}"


def _validate_token(token: str) -> dict[str, Any]:
    try:
        encoded_payload, encoded_sig = token.split(".", 1)
        payload_raw = _b64url_decode(encoded_payload)
        expected_sig = hmac.new(
            SESSION_SIGNING_KEY.encode("utf-8"), payload_raw, hashlib.sha256
        ).digest()
        received_sig = _b64url_decode(encoded_sig)
        if not hmac.compare_digest(expected_sig, received_sig):
            raise ValueError("invalid signature")
        payload = json.loads(payload_raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="invalid token") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="expired token")
    return payload


def _append_audit_event(event_type: str, payload: dict[str, Any]) -> None:
    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    line = {
        "event_type": event_type,
        "timestamp_ms": int(time.time() * 1000),
        **payload,
    }
    with AUDIT_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(line, ensure_ascii=True) + "\n")


class ConfigMessage(BaseModel):
    type: str
    session_id: str
    source_lang: str
    target_lang: str
    sample_rate: int = 16000
    format: str = "s16le"


class EndMessage(BaseModel):
    type: str


class SessionCreateRequest(BaseModel):
    display_name: str
    role: str


class SessionCreateResponse(BaseModel):
    token: str
    user_id: str
    expires_at: int


class SessionValidateRequest(BaseModel):
    token: str


class ChatTranslateRequest(BaseModel):
    token: str
    text: str
    source_lang: str
    target_lang: str


class ChatTranslateResponse(BaseModel):
    translated_text: str


class ConsentEventRequest(BaseModel):
    token: str
    call_id: str
    consent_recording: bool


class ConsentEventResponse(BaseModel):
    status: str
    consent_id: str


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


@app.post("/api/auth/session", response_model=SessionCreateResponse)
async def create_session(payload: SessionCreateRequest) -> SessionCreateResponse:
    now = int(time.time())
    exp = now + SESSION_TTL_SECONDS
    user_id = uuid.uuid4().hex
    role = payload.role.strip().lower()
    if role not in {"agent", "investor"}:
        raise HTTPException(status_code=400, detail="invalid role")

    session_payload = {
        "user_id": user_id,
        "display_name": payload.display_name.strip()[:80],
        "role": role,
        "iat": now,
        "exp": exp,
    }
    token = _sign_payload(session_payload)
    _append_audit_event(
        "session_created",
        {"user_id": user_id, "role": role, "display_name": session_payload["display_name"]},
    )
    return SessionCreateResponse(token=token, user_id=user_id, expires_at=exp)


@app.post("/api/auth/validate")
async def validate_session(payload: SessionValidateRequest) -> dict[str, Any]:
    session = _validate_token(payload.token)
    return {
        "valid": True,
        "user_id": session["user_id"],
        "display_name": session["display_name"],
        "role": session["role"],
        "expires_at": session["exp"],
    }


@app.post("/api/chat/translate", response_model=ChatTranslateResponse)
async def translate_chat(payload: ChatTranslateRequest) -> ChatTranslateResponse:
    _validate_token(payload.token)
    mt_backend = build_mt_backend()
    translated = mt_backend.translate(payload.text, payload.source_lang, payload.target_lang)
    return ChatTranslateResponse(translated_text=translated)


@app.post("/api/sessions/consent", response_model=ConsentEventResponse)
async def register_consent(payload: ConsentEventRequest) -> ConsentEventResponse:
    session = _validate_token(payload.token)
    consent_id = uuid.uuid4().hex
    _append_audit_event(
        "recording_consent",
        {
            "consent_id": consent_id,
            "call_id": payload.call_id,
            "consent_recording": payload.consent_recording,
            "user_id": session["user_id"],
            "role": session["role"],
        },
    )
    return ConsentEventResponse(status="ok", consent_id=consent_id)


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
