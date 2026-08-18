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

// Derives the public key portion (x, y) from an ECDH private JWK. EC private
// JWKs carry the public point, so no crypto operation is required.
export function publicFromPrivate(privateJwk: JsonWebKey): JsonWebKey {
  return { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypts the private key so it can be stored server-side and recovered on
// another device using the account password (PBKDF2 -> AES-GCM).
export async function encryptKeyBackup(
  privateJwk: JsonWebKey,
  passphrase: string
): Promise<{ cipher: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveBackupKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(privateJwk));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const packed = new Uint8Array(iv.length + cipherBuf.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipherBuf), iv.length);
  return { cipher: toBase64(packed.buffer), salt: toBase64(salt.buffer) };
}

export async function decryptKeyBackup(
  cipher: string,
  salt: string,
  passphrase: string
): Promise<JsonWebKey> {
  const key = await deriveBackupKey(passphrase, fromBase64(salt));
  const packed = fromBase64(cipher);
  const iv = packed.slice(0, 12);
  const data = packed.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain)) as JsonWebKey;
}

// --- Symmetric group-key helpers -------------------------------------------

export async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ]);
}

export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw);
}

export async function importSymmetricKey(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(rawB64), { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ]);
}

// Encrypts/decrypts message content with a conversation's symmetric group key.
export async function aesEncrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const packaged = new Uint8Array(iv.length + cipher.byteLength);
  packaged.set(iv, 0);
  packaged.set(new Uint8Array(cipher), iv.length);
  return toBase64(packaged.buffer);
}

export async function aesDecrypt(payload: string, key: CryptoKey): Promise<string> {
  const packaged = fromBase64(payload);
  const iv = packaged.slice(0, 12);
  const cipher = packaged.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
