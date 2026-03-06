import { useEffect, useRef, useState } from 'react';

import { computeInboundStats, InboundStatsCache } from '../utils/webrtcStats';

export interface WebRtcStatsSnapshot {
  bitrateKbps: number | null;
  packetLossPct: number | null;
  rttMs: number | null;
  jitterMs: number | null;
  iceState: string;
  connectionState: string;
}

export function useWebRtcStats(
  peerConnection: RTCPeerConnection | null,
  active: boolean,
) {
  const [stats, setStats] = useState<WebRtcStatsSnapshot>({
    bitrateKbps: null,
    packetLossPct: null,
    rttMs: null,
    jitterMs: null,
    iceState: '',
    connectionState: '',
  });
  const cacheRef = useRef<InboundStatsCache | null>(null);

  useEffect(() => {
    if (!active || !peerConnection) return;
    const interval = window.setInterval(async () => {
      try {
        const report = await peerConnection.getStats();
        const snapshot = computeInboundStats(report, cacheRef.current);
        cacheRef.current = snapshot.cache;
        setStats({
          bitrateKbps: snapshot.bitrateKbps,
          packetLossPct: snapshot.packetLossPct,
          rttMs: snapshot.rttMs,
          jitterMs: snapshot.jitterMs,
          iceState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState,
        });
      } catch (err) {
        console.error('WebRTC stats error:', err);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [active, peerConnection]);

  return stats;
}
