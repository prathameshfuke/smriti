import Link from 'next/link';
import { ChevronRight, Check, Languages, ShieldCheck } from 'lucide-react';
import Disclaimer from '@/components/layout/Disclaimer';

const FEATURES = [
  {
    Icon: Check,
    title: 'Offline First',
    body: 'Works without internet. Syncs when connection returns.',
  },
  {
    Icon: Languages,
    title: 'Local Languages',
    body: 'Assamese, Hindi, English. Audio instructions. No reading required.',
  },
  {
    Icon: ShieldCheck,
    title: 'Clinically Grounded',
    body: 'Based on CANTAB-PAL and MoCA — gold standard memory tests.',
  },
];

const GAMES = [
  { name: 'Object Hunt', domain: 'Episodic Memory', body: 'Remember where each picture is hidden.' },
  { name: 'Word Stream', domain: 'Delayed Recall', body: 'Remember a short list, recall it later.' },
  { name: 'Quick Tap', domain: 'Processing Speed', body: 'React to the right picture, quickly.' },
  { name: 'Path Match', domain: 'Executive Function', body: 'Connect the numbers in order.' },
];

export default function LandingPage() {
  return (
    <main className="bg-surface">
      {/* HERO */}
      <section className="flex min-h-dvh flex-col items-center gap-12 bg-ink px-6 py-32 lg:flex-row">
        <div className="max-w-2xl lg:w-3/5">
          <h1 className="font-serif-display text-hero font-semibold text-surface">
            Memory and engagement, simply designed
          </h1>
          <p className="mt-6 max-w-md font-sans text-body-lg text-surface/90">
            SMRITI is cognitive care for elderly patients in rural India. Play games. Remember
            medication. Live independently.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-card bg-primary px-6 py-4 font-sans text-body-lg font-semibold text-ink-inverse transition-transform active:scale-[0.97]"
            >
              Get Started
              <ChevronRight
                size={24}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
        <div className="h-96 w-full max-w-md rounded-card bg-primary/10 lg:w-2/5" aria-hidden="true" />
      </section>

      {/* PROBLEM */}
      <section className="px-6 py-32 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif-display text-headline text-ink">Why This Matters</h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-body-lg leading-relaxed text-ink/80">
            Dementia affects 8.47% of Assam&apos;s population. Most elderly speak Assamese or
            regional languages. Existing apps are English-only. Healthcare workers are
            overwhelmed. Family caregivers need offline tools, not complexity.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif-display text-headline text-ink">What You Get</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-card border border-surface-muted bg-surface-card p-8"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/20">
                  <Icon size={20} className="text-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-sans text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 font-sans text-body text-ink/80">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GAME SHOWCASE */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif-display text-headline text-ink">4 Cognitive Games</h2>
          <p className="mt-2 font-sans text-body-lg text-ink-muted">
            Each designed for a specific cognitive domain
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {GAMES.map((game) => (
              <div
                key={game.name}
                className="rounded-tile border border-surface-muted bg-surface-card p-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/20"
                    aria-hidden="true"
                  >
                    <span className="font-serif-display text-lg text-primary">
                      {game.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans text-lg font-bold text-ink">{game.name}</h3>
                    <span className="mt-1 block font-sans text-xs font-medium text-ink-muted">
                      {game.domain}
                    </span>
                    <p className="mt-2 font-sans text-body text-ink/80">{game.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAREGIVER */}
      <section className="px-6 py-32">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
          <div className="h-80 w-full rounded-card bg-success/10" aria-hidden="true" />
          <div>
            <h2 className="font-serif-display text-headline text-ink">For Caregivers</h2>
            <p className="mt-4 font-sans text-body-lg leading-relaxed text-ink/80">
              See at a glance how your patient is doing. Track progress over weeks and months.
              Get alerts if something seems off. All data stays on your device — no cloud.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-2xl rounded-tile bg-primary p-12 text-center shadow-md">
          <h2 className="font-serif-display text-headline text-ink-inverse">
            Ready to get started?
          </h2>
          <p className="mt-4 font-sans text-body-lg text-ink-inverse/90">
            Set up SMRITI on any Android or iOS device. Set up in 5 minutes. No sign-up required.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              aria-label="Open SMRITI"
              className="inline-flex items-center gap-2 rounded-card bg-success px-6 py-4 font-sans text-body-lg font-semibold text-ink-inverse active:scale-[0.97]"
            >
              Open App
              <ChevronRight size={24} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-ink px-6 py-16 text-surface">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          <div>
            <h4 className="font-serif-display text-lg font-bold text-surface">SMRITI</h4>
            <p className="mt-2 font-sans text-sm text-surface/80">
              Cognitive care for elderly patients in rural Northeast India.
            </p>
          </div>
          <div>
            <h4 className="font-serif-display text-lg font-bold text-surface">Resources</h4>
            <ul className="mt-2 flex flex-col gap-1 font-sans text-sm text-surface/80">
              <li>
                <a href="/docs" aria-label="Documentation">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#clinical-basis" aria-label="Clinical basis">
                  Clinical Basis
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/prathameshfuke/smriti"
                  aria-label="SMRITI on GitHub"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a href="mailto:support@smriti.app" aria-label="Report a bug by email">
                  Report Bug
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif-display text-lg font-bold text-surface">Legal</h4>
            <div className="mt-2 text-surface/80 [&>footer]:px-0 [&>footer]:py-0 [&>footer]:text-left [&>footer]:text-xs">
              <Disclaimer />
            </div>
            <ul className="mt-4 flex flex-col gap-1 font-sans text-sm text-surface/80">
              <li>
                <a href="#privacy" aria-label="Privacy policy">
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/prathameshfuke/smriti/blob/main/LICENSE"
                  aria-label="MIT License"
                  target="_blank"
                  rel="noreferrer"
                >
                  License: MIT
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-5xl border-t border-surface/20 pt-8 text-center">
          <p className="font-sans text-xs text-surface/60">
            © 2026 SMRITI. Built with Bhashini (MeitY) and LGBRIMH Tezpur.
          </p>
        </div>
      </footer>
    </main>
  );
}
