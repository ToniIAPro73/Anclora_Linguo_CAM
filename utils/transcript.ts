export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestampMs: number;
}

const DEFAULT_SEGMENT_MS = 4000;
const MIN_SEGMENT_MS = 1200;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function pad3(value: number): string {
  return value.toString().padStart(3, '0');
}

function formatVttTimestamp(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function formatSrtTimestamp(ms: number): string {
  return formatVttTimestamp(ms).replace('.', ',');
}

function normalizeEntries(entries: TranscriptEntry[]): TranscriptEntry[] {
  return entries
    .filter((entry) => entry.text.trim().length > 0)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function resolveSegmentBounds(entries: TranscriptEntry[], index: number, baseTsMs: number) {
  const current = entries[index];
  const currentStartMs = Math.max(0, current.timestampMs - baseTsMs);
  const nextStartMs = index + 1 < entries.length
    ? Math.max(currentStartMs + MIN_SEGMENT_MS, entries[index + 1].timestampMs - baseTsMs - 100)
    : currentStartMs + DEFAULT_SEGMENT_MS;
  return { startMs: currentStartMs, endMs: nextStartMs };
}

export function toVtt(entries: TranscriptEntry[]): string {
  const normalized = normalizeEntries(entries);
  if (!normalized.length) return 'WEBVTT\n';

  const baseTsMs = normalized[0].timestampMs;
  const lines = ['WEBVTT', ''];
  normalized.forEach((entry, index) => {
    const { startMs, endMs } = resolveSegmentBounds(normalized, index, baseTsMs);
    lines.push(`${formatVttTimestamp(startMs)} --> ${formatVttTimestamp(endMs)}`);
    lines.push(`${entry.speaker}: ${entry.text.trim()}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function toSrt(entries: TranscriptEntry[]): string {
  const normalized = normalizeEntries(entries);
  if (!normalized.length) return '';

  const baseTsMs = normalized[0].timestampMs;
  const lines: string[] = [];
  normalized.forEach((entry, index) => {
    const { startMs, endMs } = resolveSegmentBounds(normalized, index, baseTsMs);
    lines.push(String(index + 1));
    lines.push(`${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(endMs)}`);
    lines.push(`${entry.speaker}: ${entry.text.trim()}`);
    lines.push('');
  });
  return lines.join('\n');
}
