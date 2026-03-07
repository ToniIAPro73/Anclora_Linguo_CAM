import { describe, expect, it } from 'vitest';

import { detectLanguageHeuristic } from './languageDetection';

describe('detectLanguageHeuristic', () => {
  it('detects cyrillic as russian', () => {
    const result = detectLanguageHeuristic('привет, как дела');
    expect(result.code).toBe('ru');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('detects spanish hints', () => {
    const result = detectLanguageHeuristic('hola, gracias por su ayuda');
    expect(result.code).toBe('es');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('returns auto on short/unknown text', () => {
    const result = detectLanguageHeuristic('ok');
    expect(result.code).toBe('auto');
  });
});
