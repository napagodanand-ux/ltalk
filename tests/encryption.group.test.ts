import { describe, it, expect } from 'vitest';
import {
  generateSymmetricKey,
  exportSymmetricKey,
  importSymmetricKey,
  aesEncrypt,
  aesDecrypt
} from '../src/renderer/lib/encryption';

describe('group symmetric key', () => {
  it('round-trips export/import of a symmetric key', async () => {
    const key = await generateSymmetricKey();
    const raw = await exportSymmetricKey(key);
    const restored = await importSymmetricKey(raw);
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
    const plain = 'hello group';
    const cipher = await aesEncrypt(plain, restored);
    expect(cipher).not.toContain(plain);
    expect(await aesDecrypt(cipher, restored)).toBe(plain);
  });

  it('encrypts and decrypts distinct messages with the same key', async () => {
    const key = await generateSymmetricKey();
    const a = await aesEncrypt('first', key);
    const b = await aesEncrypt('second', key);
    expect(a).not.toBe(b);
    expect(await aesDecrypt(a, key)).toBe('first');
    expect(await aesDecrypt(b, key)).toBe('second');
  });

  it('fails to decrypt with a different key', async () => {
    const k1 = await generateSymmetricKey();
    const k2 = await generateSymmetricKey();
    const cipher = await aesEncrypt('secret', k1);
    await expect(aesDecrypt(cipher, k2)).rejects.toBeTruthy();
  });
});
