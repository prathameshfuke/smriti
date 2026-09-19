import { describe, expect, it } from 'vitest';
import {
  createCloudKey,
  decryptCloudField,
  decryptPhotoBytes,
  encryptCloudField,
  encryptPhotoBytes,
  unwrapCloudKey,
  WrongPassphraseError,
} from '@/lib/memoryBank/cloudCrypto';

// Low iteration count keeps the test fast; production uses KDF_ITERATIONS.
const ITER = 1000;

describe('Memory Bank cloud key', () => {
  it('unwraps with the right passphrase only', async () => {
    const { key, wrapped } = await createCloudKey('correct horse battery', ITER);
    expect(await unwrapCloudKey('correct horse battery', wrapped)).toEqual(key);
    await expect(unwrapCloudKey('wrong passphrase!!', wrapped)).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(wrapped.wrapped_key).not.toContain(Buffer.from(key).toString('base64'));
  });

  it('refuses a short passphrase', async () => {
    await expect(createCloudKey('short', ITER)).rejects.toThrow();
  });
});

describe('Memory Bank field encryption', () => {
  it('round-trips and never leaves plain text in the stored value', async () => {
    const { key } = await createCloudKey('correct horse battery', ITER);
    const stored = encryptCloudField(key, 'id-1', 'detail', 'Meena lives at 12 Paona Bazar, Imphal');
    expect(stored.startsWith('enc1:')).toBe(true);
    expect(stored).not.toMatch(/Meena|Imphal|Paona/);
    expect(decryptCloudField(key, 'id-1', 'detail', stored)).toBe('Meena lives at 12 Paona Bazar, Imphal');
  });

  it('fails when a ciphertext is moved to another row or field', async () => {
    const { key } = await createCloudKey('correct horse battery', ITER);
    const stored = encryptCloudField(key, 'id-1', 'title', 'Meena');
    expect(() => decryptCloudField(key, 'id-2', 'title', stored)).toThrow();
    expect(() => decryptCloudField(key, 'id-1', 'detail', stored)).toThrow();
  });

  it('rejects plain text coming back from the server', async () => {
    const { key } = await createCloudKey('correct horse battery', ITER);
    expect(() => decryptCloudField(key, 'id-1', 'title', 'Meena')).toThrow(/not encrypted/);
  });

  it('fails with another account’s key', async () => {
    const a = await createCloudKey('correct horse battery', ITER);
    const b = await createCloudKey('another long phrase', ITER);
    const stored = encryptCloudField(a.key, 'id-1', 'title', 'Meena');
    expect(() => decryptCloudField(b.key, 'id-1', 'title', stored)).toThrow();
  });

  it('encrypts photo bytes bound to the entry', async () => {
    const { key } = await createCloudKey('correct horse battery', ITER);
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const sealed = encryptPhotoBytes(key, 'id-1', photo);
    expect(decryptPhotoBytes(key, 'id-1', sealed)).toEqual(photo);
    expect(() => decryptPhotoBytes(key, 'id-2', sealed)).toThrow();
  });
});
