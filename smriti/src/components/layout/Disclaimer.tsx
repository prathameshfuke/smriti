'use client';

import { useTranslation } from '@/lib/i18n/provider';

/** Rendered on every page via the root layout — never diagnostic language. */
export default function Disclaimer() {
  const { t } = useTranslation();
  return (
    <footer className="px-4 py-3 text-center text-patient-sm text-ink-muted">
      {t('disclaimer')}
    </footer>
  );
}
