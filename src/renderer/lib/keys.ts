let privateKey: JsonWebKey | null = null;

export function setPrivateKey(key: JsonWebKey): void {
  privateKey = key;
}

export function getPrivateKey(): JsonWebKey | null {
  return privateKey;
}

export function clearPrivateKey(): void {
  privateKey = null;
}
