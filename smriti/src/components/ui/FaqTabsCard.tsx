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
 * A Level-1 card whose body is a navigational tab bar (DESIGN.md's
 * Responsive Behavior: horizontal scroll, never wrap, active indicator on
 * the button itself) switching between one FAQ answer at a time, rather
 * than a stacked accordion — fewer competing headings on a caregiver
 * settings page that's already several sections long.
 */
export default function FaqTabsCard({ title, items }: FaqTabsCardProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const reduceMotion = useReducedMotion();
  const active = items.find((i) => i.id === activeId) ?? items[0];

  if (!active) return null;

  return (
    <div className="rounded-card border border-line200 bg-white p-4">
      <p className="font-serif-display text-lg font-semibold text-navy">{title}</p>

      <div
        role="tablist"
        aria-label={title}
        className="mt-3 flex gap-2 overflow-x-auto"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active.id}
            onClick={() => setActiveId(item.id)}
            className={
              'shrink-0 whitespace-nowrap border-b-2 px-1 pb-2 text-caregiver-body font-semibold ' +
              'transition-colors focus-visible:outline focus-visible:outline-2 ' +
              'focus-visible:outline-primary ' +
              (item.id === active.id
                ? 'border-muga text-navy'
                : 'border-transparent text-ink-muted hover:text-ink')
            }
          >
            {item.question}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-caregiver-body text-ink-muted"
          >
            {active.answer}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
