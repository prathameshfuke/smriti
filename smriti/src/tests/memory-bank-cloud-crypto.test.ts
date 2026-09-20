import { describe, expect, it } from 'vitest';
import {
  createCloudKey,
  decryptCloudField,
  decryptPhotoBytes,
  encryptCloudField,
  encryptPhotoBytes,
  isWellFormedRecoveryCode,
  NoRecoveryCodeError,
  normalizeRecoveryCode,
  rewrapWithPassphrase,
  unwrapCloudKey,
  unwrapWithRecoveryCode,
  WrongPassphraseError,
  WrongRecoveryCodeError,
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

describe('recovery code', () => {
  it('opens the same key as the passphrase, and is generated fresh each time', async () => {
    const a = await createCloudKey('correct horse battery', ITER);
    const b = await createCloudKey('correct horse battery', ITER);
    expect(a.recoveryCode).not.toBe(b.recoveryCode);
    expect(isWellFormedRecoveryCode(a.recoveryCode)).toBe(true);
    expect(await unwrapWithRecoveryCode(a.recoveryCode, a.wrapped)).toEqual(a.key);
  });

  it('is never stored in the clear next to the key', async () => {
    const { wrapped, recoveryCode } = await createCloudKey('correct horse battery', ITER);
    expect(JSON.stringify(wrapped)).not.toContain(recoveryCode.replace(/-/g, ''));
    expect(wrapped.recovery_wrapped_key).not.toBe(wrapped.wrapped_key);
  });

  it('rejects another account’s code and a wrong one', async () => {
    const a = await createCloudKey('correct horse battery', ITER);
    const b = await createCloudKey('another long phrase', ITER);
    await expect(unwrapWithRecoveryCode(b.recoveryCode, a.wrapped)).rejects.toBeInstanceOf(WrongRecoveryCodeError);
    await expect(unwrapWithRecoveryCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', a.wrapped)).rejects.toBeInstanceOf(
      WrongRecoveryCodeError,
    );
  });

  it('accepts the code as it was written down, however it is typed back', async () => {
    const { key, wrapped, recoveryCode } = await createCloudKey('correct horse battery', ITER);
    const typed = recoveryCode.toLowerCase().replace(/-/g, ' ');
    expect(await unwrapWithRecoveryCode(typed, wrapped)).toEqual(key);
    expect(normalizeRecoveryCode(typed)).toBe(recoveryCode);
  });

  it('uses no character that can be misread when handwritten', async () => {
    const { recoveryCode } = await createCloudKey('correct horse battery', ITER);
    expect(recoveryCode).not.toMatch(/[ILOU]/);
    expect(recoveryCode.replace(/-/g, '')).toHaveLength(24);
  });

  it('tells an older account apart from a wrong code', async () => {
    const { wrapped, recoveryCode } = await createCloudKey('correct horse battery', ITER);
    const legacy = { ...wrapped, recovery_wrapped_key: null, recovery_salt: null };
    await expect(unwrapWithRecoveryCode(recoveryCode, legacy)).rejects.toBeInstanceOf(NoRecoveryCodeError);
  });

  it('re-wrapping under a new passphrase keeps the key, the entries and the same code', async () => {
    const { key, wrapped, recoveryCode } = await createCloudKey('correct horse battery', ITER);
    const stored = encryptCloudField(key, 'id-1', 'detail', 'Lives at 12 Paona Bazar');

    const recovered = await unwrapWithRecoveryCode(recoveryCode, wrapped);
    const rewrapped = await rewrapWithPassphrase(recovered, 'a whole new phrase', wrapped, ITER);

    expect(await unwrapCloudKey('a whole new phrase', rewrapped)).toEqual(key);
    await expect(unwrapCloudKey('correct horse battery', rewrapped)).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(await unwrapWithRecoveryCode(recoveryCode, rewrapped)).toEqual(key);
    // The entries were never re-encrypted.
    expect(decryptCloudField(recovered, 'id-1', 'detail', stored)).toBe('Lives at 12 Paona Bazar');
  });
});
