export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function extractRoomCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const room = parsed.searchParams.get('room') || parsed.searchParams.get('ROOM');
      if (room) return normalizeRoomCode(room);
    } catch {
      return normalizeRoomCode(trimmed);
    }
  }

  const roomMatch = trimmed.match(/[?&]room=([^&]+)/i);
  if (roomMatch?.[1]) {
    return normalizeRoomCode(decodeURIComponent(roomMatch[1]));
  }

  return normalizeRoomCode(trimmed);
}

export function buildInviteLink(origin: string, pathname: string, roomCode: string): string {
  const room = encodeURIComponent(normalizeRoomCode(roomCode));
  return `${origin}${pathname}?room=${room}`;
}

export function shouldInitiateCall(myPeerId: string, initiatorPeerId: string | null): boolean {
  return Boolean(myPeerId && initiatorPeerId && myPeerId === initiatorPeerId);
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
