import { webcrypto } from 'node:crypto';

// Node exposes Web Crypto as `webcrypto`; the app code expects the browser
// global `crypto` (with `crypto.subtle`). Polyfill it for the test runtime.
if (!(globalThis as { crypto?: Crypto }).crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as Crypto;
}
