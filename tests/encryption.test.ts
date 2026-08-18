import { describe, it, expect } from 'vitest';
import { generateKeyPair, encryptMessage, decryptMessage } from '../src/renderer/lib/encryption';

describe('E2EE', () => {
  it('round-trips a message between two participants', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();

    // Alice sends to Bob: encrypt with Alice's private + Bob's public.
    const cipher = await encryptMessage('hello bob', alice.privateKeyJwk, bob.publicKeyJwk);
    // Bob decrypts with Bob's private + Alice's public.
    const plain = await decryptMessage(cipher, bob.privateKeyJwk, alice.publicKeyJwk);

    expect(plain).toBe('hello bob');
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const a = await encryptMessage('same', alice.privateKeyJwk, bob.publicKeyJwk);
    const b = await encryptMessage('same', alice.privateKeyJwk, bob.publicKeyJwk);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong counterparty key', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const eve = await generateKeyPair();

    const cipher = await encryptMessage('secret', alice.privateKeyJwk, bob.publicKeyJwk);
    // Eve tries to decrypt using Alice's public (wrong counterparty).
    await expect(
      decryptMessage(cipher, eve.privateKeyJwk, alice.publicKeyJwk)
    ).rejects.toBeTruthy();
  });
});
