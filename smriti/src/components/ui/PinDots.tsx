export interface PinDotsProps {
  filled: number;
  length?: number;
}

/**
 * How many PIN digits have been entered so far. Drawn as outlined squares
 * that fill in, so progress reads without counting asterisks. Hidden from
 * assistive tech: each PinPad key already announces itself.
 */
export default function PinDots({ filled, length = 4 }: PinDotsProps) {
  return (
    <div aria-hidden="true" className="flex gap-3">
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className={
            'h-5 w-5 rounded-full border-2 transition-colors duration-150 ' +
            (i < filled ? 'border-primary bg-primary' : 'border-ink-muted/60 bg-transparent')
          }
        />
      ))}
    </div>
  );
}
