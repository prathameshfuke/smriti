import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, ArrowRight, CheckCircle2, Globe2, Brain } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import appIcon from '@/appicon.png';
import smritiLogo from '@/smritiweb.png';

const PROOF = [
  {
    title: 'Offline-first',
    body: 'Core routines remain useful when the signal does not.',
  },
  {
    title: 'Private by nature',
    body: 'Personal care details stay on the device — no cloud by default.',
  },
  {
    title: 'Accessible for everyone',
    body: 'Large type, calm interactions, and language that never assumes technical confidence.',
  },
];

const HOLD = [
  {
    n: '01',
    title: 'Games',
    body: '14 short cognitive games, each built for a specific domain — memory, attention, recall.',
  },
  {
    n: '02',
    title: 'Reminders',
    body: 'Gentle medication and routine prompts that arrive at the right moment, never make a person feel behind.',
  },
  {
    n: '03',
    title: 'Reassurance',
    body: 'A shared sense of how a session went, especially when family members are far apart.',
  },
];

const GAMES = [
  { name: 'Memory Match', domain: 'Episodic Memory', body: 'Tap matching pairs of everyday objects.' },
  { name: 'Object Hunt', domain: 'Visual Recall', body: 'Remember where each picture is hidden.' },
  { name: 'Word Stream', domain: 'Delayed Recall', body: 'Remember a short list, then recall it.' },
  { name: 'Quick Tap', domain: 'Processing Speed', body: 'Tap the picture as soon as you see it.' },
  { name: 'Path Match', domain: 'Spatial Sequencing', body: 'Join the numbers in order.' },
  { name: 'Memory Blocks', domain: 'Working Memory', body: 'Watch a pattern light up, then repeat it.' },
  { name: 'Frog Leap', domain: 'Sequence Memory', body: 'Watch the frog jump, then trace its path.' },
  { name: 'Counting Boxes', domain: 'Visual Attention', body: 'Watch the boxes appear, then count them.' },
  { name: 'Larger Number', domain: 'Numeracy & Attention', body: 'Tap the larger of two numbers, round after round.' },
  { name: 'Memory Span', domain: 'Short-Term Memory', body: 'Study a short word list, then recall it.' },
  { name: 'Fish Trace', domain: 'Sustained Attention', body: 'Track the glowing fish among the rest.' },
  { name: 'Double Decision', domain: 'Divided Attention', body: 'Notice what is in the middle and at the edge, together.' },
  { name: 'N-Back', domain: 'Working Memory', body: 'Say whether a tile or sound matches a few steps back.' },
  { name: 'Memory Match: Family & Life', domain: 'Reminiscence recall', body: 'A quiz built from your own family photos and stories.' },
];

const JOURNAL = [
  {
    kind: '01 / FIELD NOTE',
    title: 'What a care routine sounds like when it belongs to everyone.',
    tint: false,
  },
  {
    kind: '02 / DESIGN NOTE',
    title: 'Why offline-first is a form of respect.',
    tint: true,
  },
  {
    kind: '03 / CONVERSATION',
    title: 'The distance between checking in and being there.',
    tint: false,
  },
];

/** Gamosa-stripe ambient texture: a slow-drifting field of thin diagonal
 *  lines in gamosa red at very low opacity, evoking the woven border of an
 *  Assamese gamosa without literally depicting the cloth. Inline style, not
 *  a Tailwind gradient utility, and the drift utility is motion-safe only. */
function GamosaTexture() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.05] motion-safe:animate-stripe-drift"
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, #BE3A34 0px, #BE3A34 2px, transparent 2px, transparent 26px)',
        backgroundSize: '520px 520px',
      }}
    />
  );
}

/** Hero visual: a line-art phone showing a tile grid (the games) and a
 *  reminder badge (medication), rendered in the ink/terracotta palette in
 *  place of stock photography — this cohort's real screens, drawn plainly. */
function HeroIllustration() {
  return (
    <svg viewBox="0 0 360 400" className="h-full w-full" aria-hidden="true">
      <rect x="70" y="16" width="220" height="368" rx="30" fill="#F8F7F3" stroke="#151312" strokeWidth="3" />
      <rect x="70" y="16" width="220" height="368" rx="30" fill="none" stroke="#B3452D" strokeWidth="1" opacity="0.4" />
      <rect x="150" y="30" width="60" height="6" rx="3" fill="#151312" opacity="0.5" />

      <rect x="94" y="64" width="76" height="76" rx="16" fill="#B3452D" opacity="0.16" />
      <rect x="190" y="64" width="76" height="76" rx="16" fill="#933A27" opacity="0.14" />
      <rect x="94" y="160" width="76" height="76" rx="16" fill="#C9A227" opacity="0.16" />
      <rect x="190" y="160" width="76" height="76" rx="16" fill="#E7B2A2" opacity="0.3" />

      <circle cx="132" cy="102" r="18" fill="none" stroke="#933A27" strokeWidth="3" />
      <path d="M132 94v8l6 4" fill="none" stroke="#933A27" strokeWidth="3" strokeLinecap="round" />

      <path d="M212 90 l14 14 22 -22" fill="none" stroke="#B3452D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      <rect x="106" y="182" width="52" height="32" rx="6" fill="none" stroke="#C9A227" strokeWidth="3" />
      <path d="M118 182v-8a6 6 0 0 1 12 0v8" fill="none" stroke="#C9A227" strokeWidth="3" />

      <path
        d="M202 214 l10 -18 8 30 6 -14 6 8 h20"
        fill="none"
        stroke="#933A27"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <rect x="94" y="256" width="172" height="96" rx="18" fill="#F0EEE9" stroke="#151312" strokeWidth="2" />
      <circle cx="128" cy="304" r="22" fill="none" stroke="#B3452D" strokeWidth="4" />
      <path d="M128 288 A16 16 0 1 1 112 304" fill="none" stroke="#933A27" strokeWidth="4" strokeLinecap="round" />
      <rect x="164" y="288" width="80" height="8" rx="4" fill="#151312" opacity="0.65" />
      <rect x="164" y="306" width="60" height="8" rx="4" fill="#151312" opacity="0.35" />
      <rect x="164" y="324" width="70" height="8" rx="4" fill="#151312" opacity="0.35" />
    </svg>
  );
}

/** Caregiver visual: a line-art monitoring card — a trend line and a status
 *  ring — matching the hero's plain, undramatized drawing style. */
function CaregiverIllustration() {
  return (
    <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden="true">
      <rect x="16" y="16" width="368" height="288" rx="24" fill="#F8F7F3" stroke="#151312" strokeWidth="3" />
      <rect x="16" y="16" width="368" height="288" rx="24" fill="none" stroke="#B3452D" strokeWidth="1" opacity="0.35" />

      <circle cx="80" cy="76" r="6" fill="#BE3A34" />
      <circle cx="102" cy="76" r="6" fill="#C9A227" />
      <circle cx="124" cy="76" r="6" fill="#B3452D" />

      <rect x="48" y="112" width="150" height="150" rx="16" fill="#F0EEE9" stroke="#151312" strokeWidth="2" />
      <polyline
        points="64,220 96,190 120,232 150,168 180,196"
        fill="none"
        stroke="#933A27"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="150" cy="168" r="6" fill="#B3452D" />

      <rect x="222" y="112" width="130" height="66" rx="14" fill="#F0EEE9" stroke="#151312" strokeWidth="2" />
      <circle cx="254" cy="145" r="20" fill="none" stroke="#39A85A" strokeWidth="5" />
      <path d="M246 145l6 6 12 -14" fill="none" stroke="#39A85A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="288" y="136" width="52" height="7" rx="3.5" fill="#151312" opacity="0.55" />
      <rect x="288" y="150" width="36" height="7" rx="3.5" fill="#151312" opacity="0.3" />

      <rect x="222" y="196" width="130" height="66" rx="14" fill="#F0EEE9" stroke="#151312" strokeWidth="2" />
      <circle cx="254" cy="229" r="20" fill="none" stroke="#C9A227" strokeWidth="5" />
      <text x="254" y="235" textAnchor="middle" fontSize="16" fill="#8B6914" fontWeight="700">
        7d
      </text>
      <rect x="288" y="220" width="52" height="7" rx="3.5" fill="#151312" opacity="0.55" />
      <rect x="288" y="234" width="40" height="7" rx="3.5" fill="#151312" opacity="0.3" />
    </svg>
  );
}

function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.12em] text-terra600 ${className}`}>
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-paper50">
      {/* NAV */}
      <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line200 bg-paper50/90 px-6 backdrop-blur">
        <span className="flex items-center gap-2.5 font-serif-display text-2xl font-medium tracking-tight text-ink950">
          <Image src={appIcon} alt="" width={28} height={28} className="h-7 w-7" priority />
          SMRITI
        </span>
        <Link
          href="/login"
          className="flex h-12 items-center justify-center rounded-control bg-terra600 px-6 text-base font-semibold text-paper50 shadow-sm transition-all duration-200 hover:bg-terra700 hover:shadow-md active:scale-[0.97]"
        >
          Get Started
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center gap-12 overflow-hidden bg-paper50 px-6 py-20 lg:flex-row lg:justify-center lg:gap-16 lg:py-0">
        <GamosaTexture />
        <div className="relative max-w-2xl lg:w-1/2">
          <Eyebrow>A companion for everyday care</Eyebrow>
          <h1 className="motion-safe:animate-rise-in mt-4 font-serif-display text-4xl font-medium leading-[0.98] text-ink950 lg:text-6xl">
            Care that stays with you, <em className="italic text-terra600">even offline</em>.
          </h1>
          <p className="motion-safe:animate-rise-in mt-6 max-w-md border-l-2 border-terra600 pl-5 text-lg leading-relaxed text-ink700 [animation-delay:150ms] lg:text-xl">
            Simple games. Remembered medication. A steadier day, lived at home.
          </p>
          <div className="motion-safe:animate-rise-in mt-8 [animation-delay:300ms]">
            <Link
              href="/login"
              className="group flex h-16 w-full items-center justify-center gap-2 rounded-control bg-terra600 px-8 text-lg font-semibold text-paper50 shadow-md transition-all duration-200 hover:bg-terra700 hover:shadow-lg active:scale-[0.97] lg:w-auto"
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
        <div className="relative h-96 w-full max-w-md rounded-panel bg-paper100 p-6 lg:w-1/2" aria-hidden="true">
          <HeroIllustration />
        </div>
      </section>

      {/* PROOF / TRUST STRIP */}
      <Reveal>
        <section className="border-t border-line200 bg-paper50 px-6 py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]">
            {PROOF.map((item, i) => (
              <div key={item.title} className="contents">
                {i > 0 && <div className="hidden bg-line200 lg:block" aria-hidden="true" />}
                <div>
                  <h3 className="font-serif-display text-2xl font-medium text-ink950">{item.title}</h3>
                  <p className="mt-3 max-w-xs text-base leading-relaxed text-ink700">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* PROBLEM */}
      <Reveal>
        <section className="bg-paper100 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <Eyebrow className="text-center">Why smriti matters</Eyebrow>
            <h2 className="mt-4 text-center font-serif-display text-3xl font-medium text-ink950 lg:text-4xl">
              A quieter kind of infrastructure.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-ink700 lg:text-lg">
              Dementia affects 8.47% of Assam&apos;s population. Most elderly speak Assamese or
              Hindi. Apps are in English. Healthcare workers are overwhelmed. Families need
              offline tools that just work.
            </p>
          </div>
        </section>
      </Reveal>

      {/* WHAT WE HOLD */}
      <Reveal>
        <section className="bg-paper50 px-6 py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div>
              <Eyebrow>What we hold</Eyebrow>
              <h2 className="mt-4 font-serif-display text-4xl font-medium leading-[1.02] text-ink950 lg:text-5xl">
                The important things, <em className="italic text-terra600">together</em>.
              </h2>
              <p className="mt-6 max-w-sm text-base leading-relaxed text-ink700">
                SMRITI is made for the everyday details that help a person feel steady, seen, and
                supported.
              </p>
            </div>
            <div className="border-t border-line200">
              {HOLD.map((item) => (
                <div key={item.n} className="grid grid-cols-[3rem_1fr] gap-6 border-b border-line200 py-8">
                  <span className="text-sm font-semibold text-terra600">{item.n}</span>
                  <div>
                    <h3 className="font-serif-display text-2xl font-medium text-ink950">{item.title}</h3>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-ink700">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* GAME SHOWCASE */}
      <Reveal>
        <section className="bg-paper100 px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Eyebrow>The games</Eyebrow>
            <h2 className="mt-4 font-serif-display text-3xl font-medium text-ink950 lg:text-4xl">
              14 cognitive games, each with a purpose.
            </h2>
            <p className="mb-10 mt-2 text-base text-ink700">
              Each designed for a specific cognitive domain, none of them a spectacle.
            </p>
            <div className="grid gap-px overflow-hidden rounded-card border border-line200 bg-line200 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((game) => (
                <div key={game.name} className="bg-paper50 p-6 transition-colors duration-200 hover:bg-white">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-terra600">
                    {game.domain}
                  </span>
                  <h3 className="mt-2 font-serif-display text-xl font-medium text-ink950">{game.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink700">{game.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* CAREGIVER */}
      <Reveal>
        <section className="bg-paper50 px-6 py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div className="h-80 w-full rounded-panel bg-paper100 p-6" aria-hidden="true">
              <CaregiverIllustration />
            </div>
            <div>
              <Eyebrow>For caregivers</Eyebrow>
              <h2 className="mt-4 font-serif-display text-3xl font-medium text-ink950 lg:text-4xl">
                A clear view, without becoming a full-time administrator.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink700">
                See how your loved one is doing at a glance. Track progress over weeks and
                months. Get alerts if something seems off. All data stays on your device — no
                cloud required.
              </p>
              <Link
                href="/login?role=caregiver"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-terra600 underline decoration-terra600/40 underline-offset-4 transition-colors hover:decoration-terra600"
              >
                Explore the caregiver view
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* FINAL CTA — terracotta full-bleed */}
      <Reveal>
        <section className="bg-terra600 px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>
              <span className="text-rose100">A softer kind of infrastructure</span>
            </Eyebrow>
            <h2 className="mt-4 font-serif-display text-3xl font-medium text-paper50 lg:text-4xl">
              Not another app to manage. A little <em className="italic text-rose100">more</em> in
              the day.
            </h2>
            <p className="mt-4 text-lg text-paper50/85">
              Download SMRITI on any Android or iOS device. Set up in five minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                aria-label="Open SMRITI"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-control bg-paper50 px-8 text-lg font-semibold text-terra600 shadow-md transition-transform duration-200 active:scale-[0.97]"
              >
                Open App
                <ChevronRight size={24} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* JOURNAL / INSIGHTS */}
      <Reveal>
        <section className="bg-paper50 px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <Eyebrow>From the smriti journal</Eyebrow>
                <h2 className="mt-4 font-serif-display text-3xl font-medium text-ink950 lg:text-4xl">
                  Notes on <em className="italic text-terra600">remembering</em>.
                </h2>
              </div>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line200 bg-line200 md:grid-cols-3">
              {JOURNAL.map((item) => (
                <article
                  key={item.kind}
                  className={`flex min-h-64 flex-col justify-between p-8 ${item.tint ? 'bg-paper100' : 'bg-paper50'}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink700">
                    {item.kind}
                  </span>
                  <h3 className="mt-6 font-serif-display text-xl font-medium leading-snug text-ink950">
                    {item.title}
                  </h3>
                  <span className="mt-8 inline-flex w-fit items-center gap-2 border-b border-terra600 pb-0.5 text-sm font-semibold text-terra600">
                    Read note
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* FEATURE STRIP */}
      <Reveal>
        <section className="bg-paper100 px-6 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
            {[
              { Icon: CheckCircle2, title: 'Offline First', body: 'Works without internet. Syncs when connected.' },
              { Icon: Globe2, title: 'Local Languages', body: 'Assamese, Hindi, English. Audio cues. No reading needed.' },
              { Icon: Brain, title: 'Clinically Grounded', body: 'Based on CANTAB-PAL and MoCA standards.' },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-card border border-line200 bg-paper50 p-6">
                <Icon size={32} strokeWidth={1.75} className="text-terra600" aria-hidden="true" />
                <h3 className="mt-4 font-serif-display text-lg font-medium text-ink950">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink700">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* FOOTER */}
      <footer className="bg-ink950 px-6 py-16 text-paper50">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-3">
          <div>
            <Image src={smritiLogo} alt="SMRITI" width={140} height={47} className="h-8 w-auto" />
            <p className="mt-3 text-sm leading-relaxed text-paper50/60">
              Cognitive care for elderly dementia patients in rural Northeast India.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-paper50/60">Resources</h4>
            <ul className="mt-4 space-y-2 text-sm text-paper50/80">
              <li>
                <a href="/docs" aria-label="Documentation" className="hover:text-paper50">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#clinical-basis" aria-label="Clinical basis" className="hover:text-paper50">
                  Clinical Basis
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/prathameshfuke/smriti"
                  aria-label="SMRITI on GitHub"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-paper50"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a href="mailto:support@smriti.app" aria-label="Report a bug by email" className="hover:text-paper50">
                  Report Bug
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-paper50/60">Legal</h4>
            <p className="mt-4 text-xs leading-relaxed text-paper50/50">
              SMRITI supports cognitive engagement. It does not diagnose or treat dementia.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-paper50/80">
              <li>
                <a href="#privacy" aria-label="Privacy policy" className="hover:text-paper50">
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/prathameshfuke/smriti/blob/main/LICENSE"
                  aria-label="MIT License"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-paper50"
                >
                  License: MIT
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl border-t border-paper50/15 pt-8 text-center">
          <p className="text-xs text-paper50/50">
            © 2026 SMRITI. Made with Bhashini (MeitY) and LGBRIMH Tezpur.
          </p>
        </div>
      </footer>
    </main>
  );
}
