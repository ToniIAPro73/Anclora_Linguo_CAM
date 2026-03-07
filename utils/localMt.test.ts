import { describe, expect, it } from 'vitest';

import { translateLocalText } from './localMt';

describe('translateLocalText', () => {
  it('translates known phrase', () => {
    expect(translateLocalText('hola', 'es', 'en')).toBe('hello');
  });

  it('translates known words and preserves unknown ones', () => {
    expect(translateLocalText('casa bonita', 'es', 'en')).toBe('house bonita');
  });

  it('returns empty for empty input', () => {
    expect(translateLocalText('   ', 'es', 'en')).toBe('');
  });
});
