<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run locally

Prerequisites:
- Node.js 20+
- Python 3.10+ (for `services/asr-mt`)

1. Install frontend dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and adjust values.
3. Start ASR/MT service:
   `cd services/asr-mt && uvicorn app.main:app --host 0.0.0.0 --port 8001`
4. Start PeerJS signaling server (repo `webrtc/peer-server`).
5. Start frontend:
   `npm run dev`

## E2E baseline (Playwright)

Run the minimal 2-browser flow (room join + call + subtitle assertion):
`npm run test:e2e`

Notes:
- No LLM API key is required in frontend.
- For production-like reliability, configure TURN in `VITE_ICE_SERVERS`.
- Call onboarding now supports room links (`?room=ROOM-CODE`) and built-in pre-call check.
- Optional SFU embedded mode: set `VITE_CALL_TOPOLOGY=sfu` and `VITE_SFU_JOIN_URL=https://your-sfu.example/join` (the room opens inside the active call view).
- Optional insertable-stream E2EE layer: set `VITE_ENABLE_INSERTABLE_E2EE=true` and `VITE_E2EE_SHARED_KEY=...`.
- Optional privacy/local MT (chat only): set `VITE_ENABLE_LOCAL_MT_PRIVACY=true`.
- Optional Bergamot-style in-browser MT provider: expose `window.BergamotTranslator.translate(...)`; app falls back to local glossary when unavailable.
- CI (`.github/workflows/ci.yml`) runs lint + unit tests + build + Playwright E2E on push/PR.
- Audio upload backpressure guard can be tuned with `VITE_ASR_WS_MAX_BUFFERED_BYTES`.
- Prometheus/Grafana setup guide: `docs/observability-prometheus-grafana.md`.
- Reproducible build guide: `docs/reproducible-builds.md`.
