import Image from 'next/image';
import Link from 'next/link';
import appIcon from '@/appicon.png';
import smritiLogo from '@/smritiweb.png';

const DOES = [
  {
    title: 'Games',
    body: 'Short cognitive games, each built for one kind of memory or attention. Difficulty adjusts to the person, never the other way round.',
  },
  {
    title: 'Reminders',
    body: 'Medicine, water and routine prompts, read aloud in their language at the right moment.',
  },
  {
    title: 'Reassurance',
    body: 'Family can see how the week went and leave a short message on the home screen, even from far away.',
  },
];

const FEATURES = [
  {
    title: 'Offline First',
    body: 'Games and reminders work without internet. Progress syncs when a connection comes back.',
  },
  {
    title: 'Local Languages',
    body: 'Assamese, Hindi, Bengali, Bodo, Manipuri, Nepali and English, with spoken prompts so reading is optional.',
  },
  {
    title: 'Clinically Grounded',
    body: 'Game design draws on CANTAB-PAL and MoCA. SMRITI supports care; it does not diagnose.',
  },
];

const GAMES = [
  { name: 'Memory Match', body: 'Tap matching pairs of everyday objects.', img: 'memory-match' },
  { name: 'Object Hunt', body: 'Remember where each picture is hidden.', img: 'object-hunt' },
  { name: 'Word Stream', body: 'Remember a short list, then recall it.', img: 'word-stream' },
  { name: 'Quick Tap', body: 'Tap the picture as soon as you see it.', img: 'quick-tap' },
  { name: 'Path Match', body: 'Join the numbers in order.', img: 'path-match' },
  { name: 'Memory Blocks', body: 'Watch a pattern light up, then repeat it.', img: 'memory-blocks' },
  { name: 'Frog Leap', body: 'Watch the frog jump, then trace its path.', img: 'frog-leap' },
  { name: 'Counting Boxes', body: 'Watch the boxes appear, then count them.', img: 'counting-boxes' },
  { name: 'Larger Number', body: 'Tap the larger of two numbers.', img: 'larger-number' },
  { name: 'Memory Span', body: 'Study a short word list, then recall it.', img: 'memory-span' },
  { name: 'Fish Trace', body: 'Keep track of the glowing fish.', img: 'fish-trace' },
  { name: 'Double Decision', body: 'Notice the middle and the edge together.', img: 'double-decision' },
  { name: 'N-Back', body: 'Say whether a tile matches a few steps back.', img: 'n-back' },
  { name: 'Family & Life Quiz', body: 'Questions built from their own family photos and stories.', img: 'reminiscence-quiz' },
];

const ctaClass =
  'inline-flex min-h-16 items-center justify-center rounded-control bg-terra600 px-8 text-lg font-bold text-paper50 ' +
  'transition-[transform,background-color] duration-150 hover:bg-terra700 active:scale-[0.98] motion-reduce:active:scale-100';

/**
 * A faithful miniature of the patient home screen: the real greeting, date
 * line, primary action and game rows, drawn with the same tokens. Shows the
 * product instead of describing it.
 */
function PatientPreview() {
  return (
    <figure className="w-full max-w-sm">
      <div
        aria-hidden="true"
        className="rounded-[1.75rem] border border-line200 bg-paper50 p-5 shadow-[0_24px_60px_-28px_rgba(21,19,18,0.35)]"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-serif-display text-base text-ink950">
            <Image src={appIcon} alt="" width={20} height={20} className="h-5 w-5" />
            SMRITI
          </span>
          <span className="text-sm font-bold text-ink700 underline decoration-ink700/40 underline-offset-4">
            Caregiver
          </span>
        </div>
        <p className="mt-6 font-serif-display text-[2rem] font-medium leading-[1.1] text-ink950">Hello, Maya</p>
        <p className="mt-2 text-lg font-bold text-ink950">Tuesday, 3 March</p>
        <p className="text-lg text-ink700">12 day streak</p>
        <div className="mt-5 flex min-h-14 items-center justify-center rounded-control bg-terra600 text-lg font-bold text-paper50">
          Ask Smriti
        </div>
        <div className="mt-3 flex min-h-14 items-center justify-center rounded-control border-2 border-ink700 bg-white text-lg font-bold text-ink950">
          Reminders
        </div>
        <p className="mt-6 font-serif-display text-xl text-ink950">Choose a game</p>
        {[
          ['memory-blocks', 'Memory Blocks'],
          ['frog-leap', 'Frog Leap'],
        ].map(([img, name]) => (
          <div
            key={img}
            className="mt-2.5 flex items-center gap-3 rounded-tile border border-line200 bg-white px-3 py-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/game-${img}.png`} alt="" className="h-10 w-10 rounded-control" />
            <span className="flex-1 text-lg font-bold text-ink950">{name}</span>
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-terra600" />
              <span className="h-2 w-2 rounded-full border border-ink700/50" />
              <span className="h-2 w-2 rounded-full border border-ink700/50" />
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-sm text-ink700">
        The patient home screen: today&apos;s date, one clear action, games in a single list.
      </figcaption>
    </figure>
  );
}

/** A slice of the caregiver overview, same tokens as the real page. */
function CaregiverPreview() {
  const rows = [
    { name: 'Maya Devi', meta: 'Age 74, Assamese', status: 'Needs attention', marker: 'bg-warning', pct: '68%', glyph: '~', glyphClass: 'bg-warning text-ink950' },
    { name: 'Hari Prasad', meta: 'Age 81, Hindi', status: 'On track', marker: 'bg-success', pct: '84%', glyph: 'check', glyphClass: 'bg-success text-ink950' },
  ];
  return (
    <div aria-hidden="true" className="w-full max-w-xl">
      <div className="flex items-start gap-3 rounded-card border border-warning/50 bg-white px-5 py-4">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-warning" />
        <div>
          <p className="text-lg font-bold text-ink950">1 patient needs a check-in</p>
          <p className="text-base text-ink700">Nothing urgent. Look in when you have a moment.</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-line200 overflow-hidden rounded-card border border-line200 bg-white">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-4">
            <span className="flex items-center gap-3">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${r.glyphClass}`}>
                {r.glyph === 'check' ? (
                  <svg width="11" height="11" viewBox="0 0 12 12">
                    <path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  r.glyph
                )}
              </span>
              <span>
                <span className="block text-lg font-bold text-ink950">{r.name}</span>
                <span className="block text-base text-ink700">{r.meta}</span>
              </span>
            </span>
            <span className="text-right font-serif-display text-2xl text-ink950">{r.pct}</span>
            <span className="flex items-center gap-2 pl-8 text-base font-bold text-ink950">
              <span className={`h-2.5 w-2.5 rounded-full ${r.marker}`} />
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-paper50 text-ink950">
      <nav
        aria-label="Main"
        className="sticky top-0 z-40 border-b border-line200 bg-paper50/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2 md:px-8">
          <span className="flex items-center gap-2.5 font-serif-display text-2xl font-medium">
            <Image src={appIcon} alt="" width={28} height={28} className="h-7 w-7" priority />
            SMRITI
          </span>
          <Link
            href="/login"
            className="inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-control bg-terra600 px-5 text-base font-bold text-paper50 transition-colors hover:bg-terra700"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-24">
        <div>
          <h1 className="motion-safe:animate-rise-in max-w-[14ch] font-serif-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.02em] md:text-[4rem]">
            Care that stays with you, even offline.
          </h1>
          <p className="motion-safe:animate-rise-in mt-6 max-w-[42ch] text-xl leading-relaxed text-ink700 [animation-delay:70ms]">
            Simple memory games, reminders read aloud, and a clear view for the family. Made for people
            living with dementia in Northeast India, and the people who care for them.
          </p>
          <div className="motion-safe:animate-rise-in mt-9 flex flex-col gap-4 [animation-delay:140ms] sm:flex-row sm:items-center">
            <Link href="/login" className={ctaClass}>
              Get started
            </Link>
            <span className="text-base text-ink700">Set up takes about five minutes.</span>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PatientPreview />
        </div>
      </section>

      <section className="border-t border-line200 bg-paper100">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 lg:py-20">
          <h2 className="max-w-[24ch] font-serif-display text-[2rem] font-medium leading-tight md:text-[2.5rem]">
            Three things, done carefully.
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {DOES.map((item) => (
              <div key={item.title}>
                <h3 className="font-serif-display text-2xl font-medium">{item.title}</h3>
                <p className="mt-3 max-w-[38ch] text-lg leading-relaxed text-ink700">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-serif-display text-[2rem] font-medium leading-tight md:text-[2.5rem]">
            14 games, each with a purpose.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink700">
            Every game trains one thing and takes a few minutes. None of them keep score against the person.
          </p>
        </div>
        <ul className="mt-10 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <li key={game.name} className="flex items-start gap-4 border-t border-line200 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/game-${game.img}.png`} alt="" className="h-12 w-12 shrink-0 rounded-control" />
              <div>
                <h3 className="text-lg font-bold">{game.name}</h3>
                <p className="mt-1 text-base leading-relaxed text-ink700">{game.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line200 bg-paper100">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="max-w-[20ch] font-serif-display text-[2rem] font-medium leading-tight md:text-[2.5rem]">
              A clear view, without becoming a full-time administrator.
            </h2>
            <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-ink700">
              Anyone who needs you is listed first, with a plain reason why. Weekly summaries, missed
              reminders and progress over months are one tap away. Care details stay on the device.
            </p>
            <Link
              href="/login?role=caregiver"
              className="mt-6 inline-flex min-h-12 items-center text-lg font-bold text-terra700 underline decoration-terra600/40 underline-offset-4 hover:decoration-terra700"
            >
              Explore the caregiver view
            </Link>
          </div>
          <CaregiverPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 lg:py-24">
        <p className="max-w-[46ch] font-serif-display text-[1.75rem] font-medium leading-snug md:text-[2.25rem]">
          Dementia affects 8.47% of Assam&apos;s population. Most older people here speak Assamese or Hindi,
          and most apps are in English.
        </p>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {FEATURES.map((item) => (
            <div key={item.title} className="border-t-2 border-ink950 pt-5">
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-2 max-w-[38ch] text-lg leading-relaxed text-ink700">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line200 bg-paper100">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="font-serif-display text-[2rem] font-medium leading-tight">Not another app to manage.</h2>
            <p className="mt-2 text-lg text-ink700">Works on any Android or iOS phone or tablet.</p>
          </div>
          <Link href="/login" className={ctaClass}>
            Get started
          </Link>
        </div>
      </section>

      <footer className="bg-ink950 px-5 py-14 text-paper50 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          <div>
            <Image src={smritiLogo} alt="SMRITI" width={140} height={47} className="h-8 w-auto" />
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-paper50/75">
              Cognitive care for older people living with dementia in Northeast India.
            </p>
          </div>
          <div>
            <h4 className="text-base font-bold text-paper50">Resources</h4>
            <ul className="mt-3 space-y-1 text-base text-paper50/80">
              <li>
                <a
                  href="https://github.com/prathameshfuke/smriti-backup"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center underline decoration-paper50/30 underline-offset-4 hover:text-paper50"
                >
                  Source code on GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@smriti.app"
                  className="inline-flex min-h-10 items-center underline decoration-paper50/30 underline-offset-4 hover:text-paper50"
                >
                  Report a problem
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-base font-bold text-paper50">Legal</h4>
            <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-paper50/75">
              SMRITI supports cognitive engagement. It does not diagnose or treat dementia.
            </p>
            <a
              href="https://github.com/prathameshfuke/smriti-backup/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-10 items-center text-base text-paper50/80 underline decoration-paper50/30 underline-offset-4 hover:text-paper50"
            >
              MIT License
            </a>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-6xl border-t border-paper50/15 pt-6 text-sm text-paper50/65">
          © 2026 SMRITI. Made with Bhashini (MeitY) and LGBRIMH Tezpur.
        </p>
      </footer>
    </main>
  );
}
