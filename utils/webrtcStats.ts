export interface InboundStatsCache {
  timestampMs: number;
  bytesReceived: number;
}

export interface WebRtcInboundSnapshot {
  bitrateKbps: number | null;
  packetLossPct: number | null;
  rttMs: number | null;
  cache: InboundStatsCache | null;
}

export function computeInboundStats(
  report: RTCStatsReport,
  prevCache: InboundStatsCache | null,
): WebRtcInboundSnapshot {
  let bytesReceived = 0;
  let packetsLost = 0;
  let packetsReceived = 0;
  let rttMs: number | null = null;

  report.forEach((stat) => {
    if (stat.type === 'inbound-rtp' && !stat.isRemote) {
      if (typeof stat.bytesReceived === 'number') {
        bytesReceived += stat.bytesReceived;
      }
      if (typeof stat.packetsLost === 'number') {
        packetsLost += stat.packetsLost;
      }
      if (typeof stat.packetsReceived === 'number') {
        packetsReceived += stat.packetsReceived;
      }
    }
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
      if (typeof stat.currentRoundTripTime === 'number') {
        rttMs = Math.round(stat.currentRoundTripTime * 1000);
      }
    }
  });

  const nowMs = Date.now();
  let bitrateKbps: number | null = null;
  if (prevCache && nowMs > prevCache.timestampMs) {
    const deltaBytes = bytesReceived - prevCache.bytesReceived;
    const deltaMs = nowMs - prevCache.timestampMs;
    if (deltaBytes >= 0) {
      bitrateKbps = Math.round((deltaBytes * 8) / deltaMs);
    }
  }

  const totalPackets = packetsLost + packetsReceived;
  const packetLossPct =
    totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 100) : null;

  return {
    bitrateKbps,
    packetLossPct,
    rttMs,
    cache: { timestampMs: nowMs, bytesReceived },
  };
}
