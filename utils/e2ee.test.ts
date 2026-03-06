import { describe, expect, it } from 'vitest';

import { xorBuffer } from './e2ee';

describe('e2ee xorBuffer', () => {
  it('is reversible with the same key', () => {
    const source = new Uint8Array([10, 20, 30, 40]).buffer;
    const key = new Uint8Array([1, 2, 3]);
    const encrypted = xorBuffer(source.slice(0), key);
    const decrypted = xorBuffer(encrypted.slice(0), key);
    expect(Array.from(new Uint8Array(decrypted))).toEqual([10, 20, 30, 40]);
  });

  it('returns input unchanged when key is empty', () => {
    const source = new Uint8Array([7, 8, 9]).buffer;
    const output = xorBuffer(source.slice(0), new Uint8Array(0));
    expect(Array.from(new Uint8Array(output))).toEqual([7, 8, 9]);
  });
});
