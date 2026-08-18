import { E2EE } from '../../../src/shared/constants';

export interface KeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: E2EE.curve },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: E2EE.curve }, false, [
    'deriveKey',
    'deriveBits'
  ]);
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: E2EE.curve }, true, []);
}

async function deriveKey(myPrivate: CryptoKey, theirPublic: CryptoKey): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256
  );
  const rawSecret = new Uint8Array(bits);
  const imported = await crypto.subtle.importKey('raw', rawSecret, { name: 'HKDF' }, false, [
    'deriveKey'
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: E2EE.hash,
      salt: new TextEncoder().encode('ltalk-session-salt'),
      info: new TextEncoder().encode('ltalk-message-key')
    },
    imported,
    { name: E2EE.aesAlg, length: E2EE.keyLength },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptMessage(
  plaintext: string,
  myPrivateJwk: JsonWebKey,
  theirPublicJwk: JsonWebKey
): Promise<string> {
  const myPrivate = await importPrivateKey(myPrivateJwk);
  const theirPublic = await importPublicKey(theirPublicJwk);
  const key = await deriveKey(myPrivate, theirPublic);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: E2EE.aesAlg, iv }, key, encoded);

  const packaged = new Uint8Array(iv.length + cipher.byteLength);
  packaged.set(iv, 0);
  packaged.set(new Uint8Array(cipher), iv.length);
  return toBase64(packaged.buffer);
}

export async function decryptMessage(
  payload: string,
  myPrivateJwk: JsonWebKey,
  theirPublicJwk: JsonWebKey
): Promise<string> {
  const myPrivate = await importPrivateKey(myPrivateJwk);
  const theirPublic = await importPublicKey(theirPublicJwk);
  const key = await deriveKey(myPrivate, theirPublic);

  const packaged = fromBase64(payload);
  const iv = packaged.slice(0, 12);
  const cipher = packaged.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: E2EE.aesAlg, iv },
    key,
    cipher
  );
  return new TextDecoder().decode(plain);
}

export function encodeKey(jwk: JsonWebKey): string {
  return toBase64(new TextEncoder().encode(JSON.stringify(jwk)).buffer);
}

export function decodeKey(value: string): JsonWebKey {
  const json = new TextDecoder().decode(fromBase64(value));
  return JSON.parse(json) as JsonWebKey;
}
