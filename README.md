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

Notes:
- No LLM API key is required in frontend.
- For production-like reliability, configure TURN in `VITE_ICE_SERVERS`.
