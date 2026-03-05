export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
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
