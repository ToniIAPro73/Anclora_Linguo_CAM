from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
MAX_TRANSLATION_CHARS_PER_SESSION = int(
    os.getenv("MAX_TRANSLATION_CHARS_PER_SESSION", "20000")
)
MAX_TTS_CHARS_PER_SESSION = int(os.getenv("MAX_TTS_CHARS_PER_SESSION", "12000"))

SESSION_USAGE: dict[str, dict[str, int]] = {}
TRANSLATION_CACHE: dict[str, str] = {}
ROOM_PARTICIPANT_TTL_SECONDS = int(os.getenv("ROOM_PARTICIPANT_TTL_SECONDS", "180"))
ROOM_REGISTRY: dict[str, dict[str, dict[str, Any]]] = {}
MAX_TELEMETRY_EVENTS_PER_SESSION = int(os.getenv("MAX_TELEMETRY_EVENTS_PER_SESSION", "500"))
TELEMETRY_EVENTS: dict[str, list[dict[str, Any]]] = {}
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "memory").strip().lower()
SQLITE_DB_PATH = Path(os.getenv("SQLITE_DB_PATH", "runtime/asr-mt.sqlite3"))
SQLITE_LOCK = threading.Lock()


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


def _sqlite_conn() -> sqlite3.Connection:
    SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_sqlite_storage() -> None:
    if STORAGE_BACKEND != "sqlite":
        return
    with SQLITE_LOCK:
        with _sqlite_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS room_presence (
                    room_code TEXT NOT NULL,
                    peer_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    last_seen INTEGER NOT NULL,
                    PRIMARY KEY (room_code, peer_id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS telemetry_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    call_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp_ms INTEGER NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_telemetry_user_id
                ON telemetry_events(user_id)
                """
            )
            conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    if STORAGE_BACKEND not in {"memory", "sqlite"}:
        raise RuntimeError(f"Unsupported STORAGE_BACKEND={STORAGE_BACKEND}")
    _init_sqlite_storage()


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


class ChatTTSRequest(BaseModel):
    token: str
    text: str
    source_lang: str
    target_lang: str


class ChatTTSResponse(BaseModel):
    text_to_speak: str
    voice_lang: str


class ConsentEventRequest(BaseModel):
    token: str
    call_id: str
    consent_recording: bool


class ConsentEventResponse(BaseModel):
    status: str
    consent_id: str


class SessionUsageRequest(BaseModel):
    token: str


class SessionUsageResponse(BaseModel):
    translated_chars: int
    tts_chars: int
    translated_limit: int
    tts_limit: int


class RoomRegisterRequest(BaseModel):
    token: str
    room_code: str
    peer_id: str


class RoomRegisterResponse(BaseModel):
    status: str
    room_code: str
    participants: int


class RoomResolveRequest(BaseModel):
    token: str
    room_code: str
    requester_peer_id: str


class RoomResolveResponse(BaseModel):
    room_code: str
    participants: int
    target_peer_id: Optional[str]
    initiator_peer_id: Optional[str]


class TelemetryEvent(BaseModel):
    type: str
    timestamp_ms: int
    payload: dict[str, Any] = {}


class TelemetryBatchRequest(BaseModel):
    token: str
    call_id: str
    events: list[TelemetryEvent]


class TelemetryBatchResponse(BaseModel):
    status: str
    accepted_events: int
    total_events_in_session: int


class TelemetrySummaryRequest(BaseModel):
    token: str


class TelemetrySummaryResponse(BaseModel):
    total_events: int
    call_started: int
    call_ended: int
    reconnect_events: int
    precheck_failures: int
    caption_metrics_events: int
    ttfc_ms_p50: Optional[int]
    ttfc_ms_p95: Optional[int]
    caption_lag_ms_p50: Optional[int]
    caption_lag_ms_p95: Optional[int]
    dropped_hypothesis_rate_pct_avg: Optional[float]


def _usage_bucket(user_id: str) -> dict[str, int]:
    bucket = SESSION_USAGE.get(user_id)
    if bucket is None:
        bucket = {"translated_chars": 0, "tts_chars": 0}
        SESSION_USAGE[user_id] = bucket
    return bucket


def _cache_key(text: str, source_lang: str, target_lang: str) -> str:
    return f"{source_lang}:{target_lang}:{text.strip().lower()}"


def _translate_with_cache(mt_backend: MTBackend, text: str, source_lang: str, target_lang: str) -> str:
    key = _cache_key(text, source_lang, target_lang)
    cached = TRANSLATION_CACHE.get(key)
    if cached is not None:
        return cached
    translated = mt_backend.translate(text, source_lang, target_lang)
    TRANSLATION_CACHE[key] = translated
    if len(TRANSLATION_CACHE) > 5000:
        TRANSLATION_CACHE.pop(next(iter(TRANSLATION_CACHE)))
    return translated


def _normalize_room_code(room_code: str) -> str:
    return room_code.strip().upper().replace(" ", "")


def _cleanup_room(room_code: str) -> None:
    if STORAGE_BACKEND == "sqlite":
        threshold = int(time.time()) - ROOM_PARTICIPANT_TTL_SECONDS
        with SQLITE_LOCK:
            with _sqlite_conn() as conn:
                conn.execute(
                    "DELETE FROM room_presence WHERE room_code = ? AND last_seen < ?",
                    (room_code, threshold),
                )
                conn.commit()
        return

    room = ROOM_REGISTRY.get(room_code)
    if room is None:
        return
    now = int(time.time())
    stale_peers = [
        peer_id
        for peer_id, entry in room.items()
        if (now - int(entry.get("last_seen", 0))) > ROOM_PARTICIPANT_TTL_SECONDS
    ]
    for peer_id in stale_peers:
        room.pop(peer_id, None)
    if not room:
        ROOM_REGISTRY.pop(room_code, None)


def _telemetry_bucket(user_id: str) -> list[dict[str, Any]]:
    if STORAGE_BACKEND == "sqlite":
        with SQLITE_LOCK:
            with _sqlite_conn() as conn:
                rows = conn.execute(
                    """
                    SELECT call_id, event_type, timestamp_ms, payload_json
                    FROM telemetry_events
                    WHERE user_id = ?
                    ORDER BY id ASC
                    LIMIT ?
                    """,
                    (user_id, MAX_TELEMETRY_EVENTS_PER_SESSION),
                ).fetchall()
        return [
            {
                "call_id": row["call_id"],
                "type": row["event_type"],
                "timestamp_ms": row["timestamp_ms"],
                "payload": json.loads(row["payload_json"]),
            }
            for row in rows
        ]

    bucket = TELEMETRY_EVENTS.get(user_id)
    if bucket is None:
        bucket = []
        TELEMETRY_EVENTS[user_id] = bucket
    return bucket


def _upsert_room_presence(
    room_code: str,
    peer_id: str,
    user_id: str,
    display_name: str,
) -> int:
    if STORAGE_BACKEND == "sqlite":
        now = int(time.time())
        threshold = now - ROOM_PARTICIPANT_TTL_SECONDS
        with SQLITE_LOCK:
            with _sqlite_conn() as conn:
                conn.execute(
                    "DELETE FROM room_presence WHERE room_code = ? AND last_seen < ?",
                    (room_code, threshold),
                )
                conn.execute(
                    """
                    INSERT INTO room_presence (room_code, peer_id, user_id, display_name, last_seen)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(room_code, peer_id) DO UPDATE SET
                      user_id=excluded.user_id,
                      display_name=excluded.display_name,
                      last_seen=excluded.last_seen
                    """,
                    (room_code, peer_id, user_id, display_name, now),
                )
                participants = conn.execute(
                    "SELECT COUNT(*) AS count FROM room_presence WHERE room_code = ?",
                    (room_code,),
                ).fetchone()["count"]
                conn.commit()
        return int(participants)

    room = ROOM_REGISTRY.setdefault(room_code, {})
    room[peer_id] = {
        "user_id": user_id,
        "display_name": display_name,
        "last_seen": int(time.time()),
    }
    _cleanup_room(room_code)
    return len(ROOM_REGISTRY.get(room_code, {}))


def _resolve_room_participants(room_code: str, requester_peer_id: str) -> RoomResolveResponse:
    if STORAGE_BACKEND == "sqlite":
        threshold = int(time.time()) - ROOM_PARTICIPANT_TTL_SECONDS
        with SQLITE_LOCK:
            with _sqlite_conn() as conn:
                conn.execute(
                    "DELETE FROM room_presence WHERE room_code = ? AND last_seen < ?",
                    (room_code, threshold),
                )
                rows = conn.execute(
                    """
                    SELECT peer_id
                    FROM room_presence
                    WHERE room_code = ?
                    ORDER BY peer_id ASC
                    """,
                    (room_code,),
                ).fetchall()
                conn.commit()
        participant_peer_ids = [row["peer_id"] for row in rows]
    else:
        _cleanup_room(room_code)
        room = ROOM_REGISTRY.get(room_code, {})
        participant_peer_ids = sorted(room.keys())

    target_peer_id = next(
        (peer for peer in participant_peer_ids if peer != requester_peer_id), None
    )
    initiator_peer_id = participant_peer_ids[0] if len(participant_peer_ids) >= 2 else None
    return RoomResolveResponse(
        room_code=room_code,
        participants=len(participant_peer_ids),
        target_peer_id=target_peer_id,
        initiator_peer_id=initiator_peer_id,
    )


def _append_telemetry_event(
    user_id: str,
    call_id: str,
    event_type: str,
    timestamp_ms: int,
    payload: dict[str, Any],
) -> bool:
    if STORAGE_BACKEND == "sqlite":
        with SQLITE_LOCK:
            with _sqlite_conn() as conn:
                current_count = conn.execute(
                    "SELECT COUNT(*) AS count FROM telemetry_events WHERE user_id = ?",
                    (user_id,),
                ).fetchone()["count"]
                if int(current_count) >= MAX_TELEMETRY_EVENTS_PER_SESSION:
                    return False
                conn.execute(
                    """
                    INSERT INTO telemetry_events (user_id, call_id, event_type, timestamp_ms, payload_json)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        call_id,
                        event_type,
                        timestamp_ms,
                        json.dumps(payload, ensure_ascii=True),
                    ),
                )
                conn.commit()
        return True

    bucket = _telemetry_bucket(user_id)
    if len(bucket) >= MAX_TELEMETRY_EVENTS_PER_SESSION:
        return False
    bucket.append(
        {
            "call_id": call_id,
            "type": event_type,
            "timestamp_ms": timestamp_ms,
            "payload": payload,
        }
    )
    return True


def _percentile(values: list[int], p: int) -> Optional[int]:
    if not values:
        return None
    sorted_values = sorted(values)
    idx = max(0, min(len(sorted_values) - 1, int((p / 100) * len(sorted_values) + 0.9999) - 1))
    return sorted_values[idx]


def build_asr_backend() -> ASRBackend:
    backend = os.getenv("ASR_BACKEND", "mock").lower()
    if backend == "streaming":
        backend = "vosk"
    elif backend == "quality":
        backend = "faster-whisper"
    if backend == "mock":
        return MockASRBackend()
    if backend == "vosk":
        from .backends import VoskASRBackend
        return VoskASRBackend()
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


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
    session = _validate_token(payload.token)
    usage = _usage_bucket(session["user_id"])
    next_chars = usage["translated_chars"] + len(payload.text)
    if next_chars > MAX_TRANSLATION_CHARS_PER_SESSION:
        raise HTTPException(status_code=429, detail="session translation quota exceeded")
    mt_backend = build_mt_backend()
    translated = _translate_with_cache(
        mt_backend, payload.text, payload.source_lang, payload.target_lang
    )
    usage["translated_chars"] = next_chars
    _append_audit_event(
        "translation_usage",
        {
            "user_id": session["user_id"],
            "translated_chars": usage["translated_chars"],
            "translated_limit": MAX_TRANSLATION_CHARS_PER_SESSION,
        },
    )
    return ChatTranslateResponse(translated_text=translated)


@app.post("/api/chat/tts", response_model=ChatTTSResponse)
async def tts_chat(payload: ChatTTSRequest) -> ChatTTSResponse:
    session = _validate_token(payload.token)
    usage = _usage_bucket(session["user_id"])
    next_chars = usage["tts_chars"] + len(payload.text)
    if next_chars > MAX_TTS_CHARS_PER_SESSION:
        raise HTTPException(status_code=429, detail="session tts quota exceeded")

    mt_backend = build_mt_backend()
    translated = _translate_with_cache(
        mt_backend, payload.text, payload.source_lang, payload.target_lang
    )
    usage["tts_chars"] = next_chars
    _append_audit_event(
        "tts_usage",
        {
            "user_id": session["user_id"],
            "tts_chars": usage["tts_chars"],
            "tts_limit": MAX_TTS_CHARS_PER_SESSION,
        },
    )
    return ChatTTSResponse(text_to_speak=translated, voice_lang=payload.target_lang or "en")


@app.post("/api/sessions/usage", response_model=SessionUsageResponse)
async def session_usage(payload: SessionUsageRequest) -> SessionUsageResponse:
    session = _validate_token(payload.token)
    usage = _usage_bucket(session["user_id"])
    return SessionUsageResponse(
        translated_chars=usage["translated_chars"],
        tts_chars=usage["tts_chars"],
        translated_limit=MAX_TRANSLATION_CHARS_PER_SESSION,
        tts_limit=MAX_TTS_CHARS_PER_SESSION,
    )


@app.post("/api/rooms/register", response_model=RoomRegisterResponse)
async def register_room(payload: RoomRegisterRequest) -> RoomRegisterResponse:
    session = _validate_token(payload.token)
    room_code = _normalize_room_code(payload.room_code)
    if len(room_code) < 4:
        raise HTTPException(status_code=400, detail="room code too short")

    participants = _upsert_room_presence(
        room_code=room_code,
        peer_id=payload.peer_id,
        user_id=session["user_id"],
        display_name=session["display_name"],
    )
    _append_audit_event(
        "room_registered",
        {
            "room_code": room_code,
            "peer_id": payload.peer_id,
            "user_id": session["user_id"],
            "participants": participants,
        },
    )
    return RoomRegisterResponse(status="ok", room_code=room_code, participants=participants)


@app.post("/api/rooms/resolve", response_model=RoomResolveResponse)
async def resolve_room(payload: RoomResolveRequest) -> RoomResolveResponse:
    _validate_token(payload.token)
    room_code = _normalize_room_code(payload.room_code)
    return _resolve_room_participants(room_code, payload.requester_peer_id)


@app.get("/api/rooms/subscribe")
async def subscribe_room(
    request: Request,
    token: str,
    room_code: str,
    requester_peer_id: str,
) -> StreamingResponse:
    _validate_token(token)
    normalized_room = _normalize_room_code(room_code)

    async def event_stream():
        started_at = time.time()
        yield "event: ready\ndata: {}\n\n"
        while True:
            if await request.is_disconnected():
                break

            resolved = _resolve_room_participants(normalized_room, requester_peer_id)
            if resolved.target_peer_id and resolved.initiator_peer_id:
                payload = {
                    "status": "paired",
                    "room_code": resolved.room_code,
                    "participants": resolved.participants,
                    "target_peer_id": resolved.target_peer_id,
                    "initiator_peer_id": resolved.initiator_peer_id,
                }
                yield f"event: paired\ndata: {json.dumps(payload, ensure_ascii=True)}\n\n"
                break

            if (time.time() - started_at) >= 25:
                payload = {"status": "timeout", "room_code": normalized_room}
                yield f"event: timeout\ndata: {json.dumps(payload, ensure_ascii=True)}\n\n"
                break

            yield "event: waiting\ndata: {}\n\n"
            await asyncio.sleep(0.25)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/telemetry/events", response_model=TelemetryBatchResponse)
async def ingest_telemetry(payload: TelemetryBatchRequest) -> TelemetryBatchResponse:
    session = _validate_token(payload.token)
    accepted = 0
    for event in payload.events:
        accepted_event = _append_telemetry_event(
            user_id=session["user_id"],
            call_id=payload.call_id,
            event_type=event.type,
            timestamp_ms=event.timestamp_ms,
            payload=event.payload,
        )
        if not accepted_event:
            break
        accepted += 1
        _append_audit_event(
            "telemetry_event",
            {
                "user_id": session["user_id"],
                "call_id": payload.call_id,
                "event_type": event.type,
            },
        )
    return TelemetryBatchResponse(
        status="ok",
        accepted_events=accepted,
        total_events_in_session=len(_telemetry_bucket(session["user_id"])),
    )


@app.post("/api/telemetry/summary", response_model=TelemetrySummaryResponse)
async def telemetry_summary(payload: TelemetrySummaryRequest) -> TelemetrySummaryResponse:
    session = _validate_token(payload.token)
    bucket = _telemetry_bucket(session["user_id"])
    call_started = sum(1 for event in bucket if event.get("type") == "call_started")
    call_ended = sum(1 for event in bucket if event.get("type") == "call_ended")
    reconnect_events = sum(
        1
        for event in bucket
        if event.get("type") in {"peer_reconnecting", "subtitle_reconnecting"}
    )
    precheck_failures = sum(
        1
        for event in bucket
        if event.get("type") == "precheck_result"
        and not bool(event.get("payload", {}).get("ok", False))
    )
    caption_metric_events = [event for event in bucket if event.get("type") == "caption_metrics"]
    ttfc_values: list[int] = []
    caption_lag_values: list[int] = []
    dropped_rates: list[float] = []
    for event in caption_metric_events:
        payload_data = event.get("payload", {})
        ttfc_value = payload_data.get("ttfc_ms")
        if isinstance(ttfc_value, (int, float)) and ttfc_value >= 0:
            ttfc_values.append(int(ttfc_value))
        lag_samples = payload_data.get("caption_lag_samples_ms")
        if isinstance(lag_samples, list):
            for sample in lag_samples:
                if isinstance(sample, (int, float)) and sample >= 0:
                    caption_lag_values.append(int(sample))
        dropped_rate = payload_data.get("dropped_hypothesis_rate_pct")
        if isinstance(dropped_rate, (int, float)) and dropped_rate >= 0:
            dropped_rates.append(float(dropped_rate))

    return TelemetrySummaryResponse(
        total_events=len(bucket),
        call_started=call_started,
        call_ended=call_ended,
        reconnect_events=reconnect_events,
        precheck_failures=precheck_failures,
        caption_metrics_events=len(caption_metric_events),
        ttfc_ms_p50=_percentile(ttfc_values, 50),
        ttfc_ms_p95=_percentile(ttfc_values, 95),
        caption_lag_ms_p50=_percentile(caption_lag_values, 50),
        caption_lag_ms_p95=_percentile(caption_lag_values, 95),
        dropped_hypothesis_rate_pct_avg=(
            round(sum(dropped_rates) / len(dropped_rates), 2) if dropped_rates else None
        ),
    )


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
    if msg_type == "segment_end":
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
