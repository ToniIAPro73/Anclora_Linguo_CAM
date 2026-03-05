import { describe, expect, it, vi } from 'vitest';

import {
  buildInviteLink,
  normalizeRoomCode,
  shouldInitiateCall,
  stopMediaStream,
} from './callSession';

describe('callSession utilities', () => {
  it('normalizes room code', () => {
    expect(normalizeRoomCode(' room-  abc ')).toBe('ROOM-ABC');
  });

  it('builds encoded invite link', () => {
    expect(buildInviteLink('https://demo.local', '/app', 'room a')).toBe(
      'https://demo.local/app?room=ROOMA',
    );
  });

  it('detects initiator peer', () => {
    expect(shouldInitiateCall('ABC123', 'ABC123')).toBe(true);
    expect(shouldInitiateCall('ABC123', 'XYZ999')).toBe(false);
  });

  it('stops all stream tracks', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopA }, { stop: stopB }],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });
});
