'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqTabsCardProps {
  title: string;
  items: FaqItem[];
}

/**
 * A Level-1 card whose questions are a grid of buttons (one column on
 * phones, two from `sm`), every question visible with no scrolling strip,
 * switching between one FAQ answer at a time, rather
 * than a stacked accordion — fewer competing headings on a caregiver
 * settings page that's already several sections long.
 */
export default function FaqTabsCard({ title, items }: FaqTabsCardProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const reduceMotion = useReducedMotion();
  const active = items.find((i) => i.id === activeId) ?? items[0];

  if (!active) return null;

  return (
    <div className="rounded-card border border-line200 bg-white p-5">
      <h2 className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">{title}</h2>

      <div
        role="tablist"
        aria-label={title}
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active.id}
            onClick={() => setActiveId(item.id)}
            className={
              'min-h-touch-min rounded-control px-4 py-2 text-left text-caregiver-body font-bold ' +
              'transition-colors focus-visible:outline focus-visible:outline-2 ' +
              'focus-visible:outline-primary-dark ' +
              (item.id === active.id
                ? 'bg-primary text-ink-inverse'
                : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:bg-surface-muted')
            }
          >
            {item.question}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-tile bg-surface-muted/60 p-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="max-w-[65ch] text-caregiver-body text-ink"
          >
            {active.answer}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
