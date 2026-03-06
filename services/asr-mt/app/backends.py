from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import os
import json


@dataclass
class SessionConfig:
    session_id: str
    source_lang: str
    target_lang: str
    sample_rate: int
    format: str


class ASRBackend:
    def start(self, config: SessionConfig) -> None:
        raise NotImplementedError

    def transcribe_chunk(self, audio_bytes: bytes) -> Optional[str]:
        raise NotImplementedError

    def finalize(self) -> Optional[str]:
        return None


class MTBackend:
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        raise NotImplementedError


class MockASRBackend(ASRBackend):
    def __init__(self) -> None:
        self._chunk_index = 0

    def start(self, config: SessionConfig) -> None:
        self._chunk_index = 0

    def transcribe_chunk(self, audio_bytes: bytes) -> Optional[str]:
        if not audio_bytes:
            return None
        self._chunk_index += 1
        return f"chunk_{self._chunk_index}"

    def finalize(self) -> Optional[str]:
        return None


class MockMTBackend(MTBackend):
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text:
            return text
        return f"[{target_lang}] {text}"


class FasterWhisperASRBackend(ASRBackend):
    def __init__(self) -> None:
        try:
            from faster_whisper import WhisperModel
            import numpy as np
        except ImportError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. Install requirements-ml.txt."
            ) from exc

        self._np = np
        model_name = os.getenv("ASR_MODEL", "small")
        device = os.getenv("ASR_DEVICE", "cpu")
        compute_type = os.getenv("ASR_COMPUTE_TYPE", "int8")
        self._model = WhisperModel(model_name, device=device, compute_type=compute_type)
        self._buffer = self._np.zeros(0, dtype=self._np.int16)
        self._sample_rate = 16000
        self._min_chunk_ms = int(os.getenv("ASR_MIN_CHUNK_MS", "600"))
        self._max_buffer_ms = int(os.getenv("ASR_MAX_BUFFER_MS", "30000"))

    def start(self, config: SessionConfig) -> None:
        self._buffer = self._np.zeros(0, dtype=self._np.int16)
        self._sample_rate = config.sample_rate

    def transcribe_chunk(self, audio_bytes: bytes) -> Optional[str]:
        if not audio_bytes:
            return None

        chunk = self._np.frombuffer(audio_bytes, dtype=self._np.int16)
        if chunk.size == 0:
            return None

        self._buffer = self._np.concatenate([self._buffer, chunk])
        buffer_ms = int((self._buffer.size / self._sample_rate) * 1000)
        if buffer_ms < self._min_chunk_ms:
            return None

        if buffer_ms > self._max_buffer_ms:
            max_samples = int((self._max_buffer_ms / 1000) * self._sample_rate)
            self._buffer = self._buffer[-max_samples:]

        audio = self._buffer.astype(self._np.float32) / 32768.0
        segments, _ = self._model.transcribe(
            audio,
            language=None,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        self._buffer = self._np.zeros(0, dtype=self._np.int16)
        return text or None

    def finalize(self) -> Optional[str]:
        if self._buffer.size == 0:
            return None
        audio = self._buffer.astype(self._np.float32) / 32768.0
        segments, _ = self._model.transcribe(
            audio,
            language=None,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        self._buffer = self._np.zeros(0, dtype=self._np.int16)
        return text or None


class VoskASRBackend(ASRBackend):
    def __init__(self) -> None:
        try:
            from vosk import KaldiRecognizer, Model, SetLogLevel
        except ImportError as exc:
            raise RuntimeError(
                "vosk is not installed. Install requirements-ml.txt."
            ) from exc

        self._KaldiRecognizer = KaldiRecognizer
        self._SetLogLevel = SetLogLevel
        self._SetLogLevel(-1)

        model_path = os.getenv("VOSK_MODEL_PATH", "").strip()
        model_name = os.getenv("VOSK_MODEL_NAME", "vosk-model-small-en-us-0.15")
        if model_path:
            self._model = Model(model_path=model_path)
        else:
            self._model = Model(model_name=model_name)
        self._recognizer = None
        self._sample_rate = 16000
        self._last_partial = ""

    def start(self, config: SessionConfig) -> None:
        self._sample_rate = config.sample_rate
        self._recognizer = self._KaldiRecognizer(self._model, self._sample_rate)
        self._last_partial = ""

    def _extract_text(self, payload_json: str, key: str) -> Optional[str]:
        try:
            payload = json.loads(payload_json)
        except json.JSONDecodeError:
            return None
        text = str(payload.get(key, "")).strip()
        return text or None

    def transcribe_chunk(self, audio_bytes: bytes) -> Optional[str]:
        if not audio_bytes or self._recognizer is None:
            return None

        has_final = self._recognizer.AcceptWaveform(audio_bytes)
        if has_final:
            text = self._extract_text(self._recognizer.Result(), "text")
            self._last_partial = text or ""
            return text

        partial = self._extract_text(self._recognizer.PartialResult(), "partial")
        if not partial or partial == self._last_partial:
            return None
        self._last_partial = partial
        return partial

    def finalize(self) -> Optional[str]:
        if self._recognizer is None:
            return None
        text = self._extract_text(self._recognizer.FinalResult(), "text")
        self._last_partial = ""
        return text


class TransformersMTBackend(MTBackend):
    def __init__(self) -> None:
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "transformers/torch not installed. Install requirements-ml.txt."
            ) from exc

        self._torch = torch
        model_name = os.getenv("MT_MODEL", "Helsinki-NLP/opus-mt-es-en")
        self._device = os.getenv("MT_DEVICE", "cpu")
        self._is_nllb = "nllb" in model_name.lower()
        self._model_name = model_name
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        self._model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self._device)
        self._model_cache = {}
        self._tokenizer_cache = {}
        self._auto_models = self._load_model_map()

    def _load_model_map(self) -> dict:
        env_map = os.getenv("MT_MODEL_MAP", "")
        if env_map:
            pairs = {}
            for item in env_map.split(","):
                if "=" not in item:
                    continue
                key, value = item.split("=", 1)
                pairs[key.strip()] = value.strip()
            return pairs
        return {
            "es-en": "Helsinki-NLP/opus-mt-es-en",
            "en-es": "Helsinki-NLP/opus-mt-en-es",
            "es-fr": "Helsinki-NLP/opus-mt-es-fr",
            "fr-es": "Helsinki-NLP/opus-mt-fr-es",
            "es-de": "Helsinki-NLP/opus-mt-es-de",
            "de-es": "Helsinki-NLP/opus-mt-de-es",
            "es-ru": "Helsinki-NLP/opus-mt-es-ru",
            "ru-es": "Helsinki-NLP/opus-mt-ru-es",
        }

    def _get_model_pair(self, source_lang: str, target_lang: str):
        if self._is_nllb:
            return self._tokenizer, self._model
        pair_key = f"{source_lang}-{target_lang}"
        model_name = self._auto_models.get(pair_key, self._model_name)
        if model_name in self._model_cache:
            return self._tokenizer_cache[model_name], self._model_cache[model_name]
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self._device)
        self._model_cache[model_name] = model
        self._tokenizer_cache[model_name] = tokenizer
        return tokenizer, model

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text:
            return text

        tokenizer, model = self._get_model_pair(source_lang, target_lang)
        if self._is_nllb:
            src_lang = map_nllb_lang(source_lang)
            tgt_lang = map_nllb_lang(target_lang)
            if src_lang:
                tokenizer.src_lang = src_lang
            inputs = tokenizer(text, return_tensors="pt").to(self._device)
            forced_bos = (
                tokenizer.lang_code_to_id.get(tgt_lang)
                if tgt_lang and hasattr(tokenizer, "lang_code_to_id")
                else None
            )
            with self._torch.inference_mode():
                output = model.generate(
                    **inputs,
                    forced_bos_token_id=forced_bos,
                )
        else:
            inputs = tokenizer(text, return_tensors="pt").to(self._device)
            with self._torch.inference_mode():
                output = model.generate(**inputs)

        return tokenizer.batch_decode(output, skip_special_tokens=True)[0]


NLLB_LANG_MAP = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "zh": "zho_Hans",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "ru": "rus_Cyrl",
}


def map_nllb_lang(code: str) -> Optional[str]:
    return NLLB_LANG_MAP.get(code)
