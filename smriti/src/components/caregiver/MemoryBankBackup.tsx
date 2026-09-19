'use client';

import { useCallback, useEffect, useState } from 'react';
import Panel, { buttonClass, fieldClass, labelClass } from '@/components/ui/Panel';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { getCloudKeyStatus, setUpCloudKey, unlockCloudKey, type CloudKeyStatus } from '@/lib/memoryBank/cloudKey';
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '@/lib/memoryBank/cloudCrypto';

/**
 * Cloud backup of the Memory Bank, protected by a passphrase only the
 * caregiver knows (see lib/memoryBank/cloudCrypto.ts). Optional: the Memory
 * Bank works fully on the phone without it; entries are just not backed up.
 */
export default function MemoryBankBackup() {
  const caregiverId = useCaregiverStore((s) => s.currentCaregiver?.id ?? null);
  const [status, setStatus] = useState<CloudKeyStatus | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (caregiverId) setStatus(await getCloudKeyStatus(caregiverId));
  }, [caregiverId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  if (!caregiverId || status === null) return null;

  const submit = async () => {
    setMessage(null);
    if (status === 'not_set_up') {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
        setMessage(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
        return;
      }
      if (passphrase !== confirm) {
        setMessage('The two passphrases are different.');
        return;
      }
    }
    setBusy(true);
    try {
      if (status === 'not_set_up') await setUpCloudKey(caregiverId, passphrase);
      else await unlockCloudKey(caregiverId, passphrase);
      setPassphrase('');
      setConfirm('');
      await refresh();
    } catch (err) {
      setMessage(
        err instanceof WrongPassphraseError
          ? 'That passphrase is not correct.'
          : 'Could not reach your account. Check the connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (status === 'ready') {
    return (
      <Panel title="Cloud backup" className="mb-6">
        <p className="text-caregiver-body text-ink-muted">
          On. Entries are encrypted on this phone before they are backed up, and sync on their own whenever there
          is a connection.
        </p>
      </Panel>
    );
  }

  if (status === 'unknown') {
    return (
      <Panel title="Cloud backup" className="mb-6">
        <p className="text-caregiver-body text-ink-muted">
          Offline. Everything you add is saved on this phone and works now; backup settings are available once you
          are connected.
        </p>
      </Panel>
    );
  }

  const settingUp = status === 'not_set_up';
  return (
    <Panel
      title="Cloud backup"
      className="mb-6"
      description={
        settingUp
          ? 'Choose a backup passphrase. The Memory Bank is encrypted with it before leaving this phone, so nobody else — including SMRITI — can read it. Write it down: if it is lost along with this phone, the backup cannot be recovered.'
          : 'This account has a cloud backup. Enter the backup passphrase once to restore it on this phone and keep it in sync.'
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="mb-passphrase" className={labelClass}>
            Backup passphrase
          </label>
          <input
            id="mb-passphrase"
            type="password"
            autoComplete={settingUp ? 'new-password' : 'current-password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className={fieldClass}
          />
        </div>
        {settingUp ? (
          <div>
            <label htmlFor="mb-passphrase-confirm" className={labelClass}>
              Type it again
            </label>
            <input
              id="mb-passphrase-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
          </div>
        ) : null}
        {message ? (
          <p role="alert" className="text-caregiver-body font-bold text-danger">
            {message}
          </p>
        ) : null}
        <button type="button" onClick={() => void submit()} disabled={busy} className={`${buttonClass.primary} self-start`}>
          {busy ? 'Working…' : settingUp ? 'Turn on backup' : 'Restore backup'}
        </button>
      </div>
    </Panel>
  );
}
