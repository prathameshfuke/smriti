'use client';

import { useCallback, useEffect, useState } from 'react';
import Panel, { buttonClass, fieldClass, labelClass } from '@/components/ui/Panel';
import { useCaregiverStore } from '@/stores/caregiverStore';
import {
  getCloudKeyStatus,
  recoverWithCode,
  setUpCloudKey,
  unlockCloudKey,
  type CloudKeyStatus,
} from '@/lib/memoryBank/cloudKey';
import {
  isWellFormedRecoveryCode,
  MIN_PASSPHRASE_LENGTH,
  NoRecoveryCodeError,
  WrongPassphraseError,
  WrongRecoveryCodeError,
} from '@/lib/memoryBank/cloudCrypto';

/**
 * Cloud backup of the Memory Bank, protected by a passphrase only the
 * caregiver knows (see lib/memoryBank/cloudCrypto.ts). Optional: the Memory
 * Bank works fully on the phone without it; entries are just not backed up.
 *
 * Setup also shows a recovery code, once. It is the only way back in if the
 * passphrase is forgotten, so the panel makes the caregiver confirm they
 * have written it down before it disappears.
 */
export default function MemoryBankBackup() {
  const caregiverId = useCaregiverStore((s) => s.currentCaregiver?.id ?? null);
  const [status, setStatus] = useState<CloudKeyStatus | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Shown once, straight after setup. */
  const [newCode, setNewCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (caregiverId) setStatus(await getCloudKeyStatus(caregiverId));
  }, [caregiverId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  if (!caregiverId || status === null) return null;

  const clearFields = () => {
    setPassphrase('');
    setConfirm('');
    setRecoveryCode('');
  };

  const failureMessage = (err: unknown): string => {
    if (err instanceof WrongPassphraseError) return 'That passphrase is not correct.';
    if (err instanceof WrongRecoveryCodeError) return 'That recovery code is not correct.';
    if (err instanceof NoRecoveryCodeError) {
      return 'This backup was set up before recovery codes, so only the passphrase can open it.';
    }
    return 'Could not reach your account. Check the connection and try again.';
  };

  const submit = async () => {
    setMessage(null);
    const settingNewPassphrase = status === 'not_set_up' || mode === 'recovery';
    if (settingNewPassphrase) {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
        setMessage(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
        return;
      }
      if (passphrase !== confirm) {
        setMessage('The two passphrases are different.');
        return;
      }
    }
    if (mode === 'recovery' && !isWellFormedRecoveryCode(recoveryCode)) {
      setMessage('A recovery code is 24 letters and numbers, in six groups.');
      return;
    }

    setBusy(true);
    try {
      if (status === 'not_set_up') {
        const { recoveryCode: code } = await setUpCloudKey(caregiverId, passphrase);
        setNewCode(code);
      } else if (mode === 'recovery') {
        await recoverWithCode(caregiverId, recoveryCode, passphrase);
      } else {
        await unlockCloudKey(caregiverId, passphrase);
      }
      clearFields();
      await refresh();
    } catch (err) {
      setMessage(failureMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (newCode) {
    return (
      <Panel title="Write this down now" className="mb-6">
        <div className="flex flex-col gap-4">
          <p className="text-caregiver-body text-ink">
            This is the recovery code for {"the patient's"} Memory Bank backup. It is the only way in if the
            passphrase is forgotten. It is shown once and cannot be shown again — write it on paper and keep it
            somewhere safe, not on this phone.
          </p>
          <p className="select-all rounded-card border-2 border-ink-muted bg-surface-muted px-4 py-4 text-center font-mono text-[1.5rem] font-bold tracking-widest text-ink">
            {newCode}
          </p>
          <button
            type="button"
            onClick={() => {
              setNewCode(null);
              void refresh();
            }}
            className={`${buttonClass.primary} self-start`}
          >
            I have written it down
          </button>
        </div>
      </Panel>
    );
  }

  if (status === 'ready') {
    return (
      <Panel title="Cloud backup" className="mb-6">
        <p className="text-caregiver-body text-ink-muted">
          On. Entries are encrypted on this phone before they are backed up, and sync on their own whenever there
          is a connection. Keep the recovery code from setup: it is the only way in if the passphrase is
          forgotten.
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
  const recovering = mode === 'recovery';
  return (
    <Panel
      title="Cloud backup"
      className="mb-6"
      description={
        settingUp
          ? 'Choose a backup passphrase. The Memory Bank is encrypted with it before leaving this phone, so nobody else — including SMRITI — can read it. You will get a recovery code to write down in case the passphrase is ever forgotten.'
          : recovering
            ? 'Enter the recovery code from when backup was set up, then choose a new passphrase. The saved entries are not affected.'
            : 'This account has a cloud backup. Enter the backup passphrase once to restore it on this phone and keep it in sync.'
      }
    >
      <div className="flex flex-col gap-4">
        {recovering ? (
          <div>
            <label htmlFor="mb-recovery-code" className={labelClass}>
              Recovery code
            </label>
            <input
              id="mb-recovery-code"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              className={`${fieldClass} font-mono tracking-widest`}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="mb-passphrase" className={labelClass}>
            {settingUp || recovering ? 'New backup passphrase' : 'Backup passphrase'}
          </label>
          <input
            id="mb-passphrase"
            type="password"
            autoComplete={settingUp || recovering ? 'new-password' : 'current-password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className={fieldClass}
          />
        </div>
        {settingUp || recovering ? (
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
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => void submit()} disabled={busy} className={buttonClass.primary}>
            {busy ? 'Working…' : settingUp ? 'Turn on backup' : recovering ? 'Recover backup' : 'Restore backup'}
          </button>
          {settingUp ? null : (
            <button
              type="button"
              onClick={() => {
                setMode(recovering ? 'passphrase' : 'recovery');
                setMessage(null);
                clearFields();
              }}
              className={buttonClass.secondary}
            >
              {recovering ? 'Use the passphrase instead' : 'I forgot the passphrase'}
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
