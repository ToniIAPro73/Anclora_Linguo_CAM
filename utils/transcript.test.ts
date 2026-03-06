import { describe, expect, it } from 'vitest';

import { toSrt, toVtt } from './transcript';

describe('transcript export', () => {
  it('builds vtt with speaker labels', () => {
    const vtt = toVtt([
      { speaker: 'Alice', text: 'Hola', timestampMs: 1000 },
      { speaker: 'Bob', text: 'Hello', timestampMs: 2800 },
    ]);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('Alice: Hola');
    expect(vtt).toContain('Bob: Hello');
  });

  it('builds srt numbered blocks', () => {
    const srt = toSrt([
      { speaker: 'You', text: 'Test one', timestampMs: 2000 },
      { speaker: 'Peer', text: 'Test two', timestampMs: 5000 },
    ]);
    expect(srt).toContain('1\n00:00:00,000 -->');
    expect(srt).toContain('2\n');
    expect(srt).toContain('Peer: Test two');
  });
});
