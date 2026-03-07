import { afterEach, describe, expect, it } from 'vitest';
import { translateWithBergamotIfAvailable } from './bergamotMt';

describe('translateWithBergamotIfAvailable', () => {
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('returns null when provider is not present', async () => {
    (globalThis as any).window = {};
    const result = await translateWithBergamotIfAvailable('hola', 'es', 'en');
    expect(result).toBeNull();
  });

  it('returns translated text when provider is present', async () => {
    (globalThis as any).window = {
      BergamotTranslator: {
      translate: async ({ text }: { text: string }) => ({ text: `x-${text}` }),
      },
    };

    const result = await translateWithBergamotIfAvailable('hola', 'es', 'en');
    expect(result).toBe('x-hola');
  });
});
