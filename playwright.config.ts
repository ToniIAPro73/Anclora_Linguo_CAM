import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
    trace: 'retain-on-failure',
    baseURL: 'http://127.0.0.1:4173',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  webServer: [
    {
      command: 'npm install && PEER_PORT=19000 npm start',
      url: 'http://127.0.0.1:19000/peerjs/peerjs/id?ts=1',
      cwd: 'webrtc/peer-server',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command:
        'python3 -m pip install -r requirements.txt && SESSION_SIGNING_KEY=e2e-demo-key ALLOWED_ORIGINS=http://127.0.0.1:4173 python3 -m uvicorn app.main:app --host 127.0.0.1 --port 18001',
      url: 'http://127.0.0.1:18001/health',
      cwd: 'services/asr-mt',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command:
        'VITE_ENABLE_E2E_HOOKS=true VITE_ASR_MT_HTTP_URL=http://127.0.0.1:18001 VITE_ASR_MT_WS_URL=ws://127.0.0.1:18001/ws/asr-mt VITE_PEER_SERVER_HOST=127.0.0.1 VITE_PEER_SERVER_PORT=19000 VITE_PEER_SERVER_PATH=/peerjs VITE_PEER_SERVER_SECURE=false npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      cwd: '.',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
