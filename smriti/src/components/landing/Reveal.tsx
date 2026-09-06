'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Wraps a landing-page section so it fades/rises into place the first time
 * it enters the viewport. Starts "pending" (invisible) only once mounted in
 * the browser — server-rendered markup stays fully visible, so content is
 * never hidden from anything that doesn't run this effect (no-JS, crawlers,
 * the render-to-string test environment).
 *
 * `prefers-reduced-motion` is handled globally in globals.css, which forces
 * every animation/transition duration to ~0 — so the reveal still happens,
 * it just no longer visibly moves.
 */
export default function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setReady(true);
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const revealClass = ready ? (visible ? 'smriti-reveal-visible' : 'smriti-reveal-pending') : '';

  return (
    <div ref={ref} className={`${revealClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
