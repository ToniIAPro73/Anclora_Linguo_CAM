const e2eeAppliedConnections = new WeakSet<RTCPeerConnection>();

export function supportsInsertableStreams(): boolean {
  const senderProto = (window as any).RTCRtpSender?.prototype;
  const receiverProto = (window as any).RTCRtpReceiver?.prototype;
  const hasEncodedStreams =
    typeof senderProto?.createEncodedStreams === 'function'
    && typeof receiverProto?.createEncodedStreams === 'function';
  const hasScriptTransform = typeof (window as any).RTCRtpScriptTransform === 'function';
  return hasEncodedStreams || hasScriptTransform;
}

export function xorBuffer(data: ArrayBuffer, key: Uint8Array): ArrayBuffer {
  if (!key.length) return data;
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] ^= key[i % key.length];
  }
  return bytes.buffer;
}

function buildKey(secret: string): Uint8Array {
  const normalized = secret.trim();
  if (!normalized) return new Uint8Array(0);
  return new TextEncoder().encode(normalized);
}

function buildXorTransform(key: Uint8Array) {
  return new TransformStream({
    transform: (frame: any, controller) => {
      if (frame?.data instanceof ArrayBuffer) {
        frame.data = xorBuffer(frame.data, key);
      }
      controller.enqueue(frame);
    },
  });
}

export function applyInsertableE2EE(pc: RTCPeerConnection, sharedKey: string): boolean {
  if (!supportsInsertableStreams()) return false;
  if (e2eeAppliedConnections.has(pc)) return true;

  const key = buildKey(sharedKey);
  if (!key.length) return false;

  const senders = pc.getSenders();
  const receivers = pc.getReceivers();

  const tryPipe = (endpoint: any) => {
    if (!endpoint || typeof endpoint.createEncodedStreams !== 'function') return;
    const streams = endpoint.createEncodedStreams();
    streams.readable
      .pipeThrough(buildXorTransform(key))
      .pipeTo(streams.writable)
      .catch(() => undefined);
  };

  senders.forEach(tryPipe);
  receivers.forEach(tryPipe);

  e2eeAppliedConnections.add(pc);
  return true;
}
