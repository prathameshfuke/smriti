import type { ReactNode } from 'react';

export interface CardColumnsProps {
  children: ReactNode;
  className?: string;
}

/**
 * A stack of cards on phones and tablets, two balanced columns from `lg` up.
 *
 * A two-column CSS grid lays cards out in rows, so each row is as tall as its
 * tallest card and the shorter neighbour leaves a hole under itself. CSS
 * multi-column flows the same children, in the same DOM order, down the left
 * column then the right and balances the two by real height, so the layout
 * copes with any content amount without min-height tricks.
 *
 * Cards are never split across columns. A child that should run the full
 * width (a FAQ, a danger zone) takes `lg:[column-span:all]`; the cards before
 * and after it then balance as separate groups.
 */
export default function CardColumns({ children, className = '' }: CardColumnsProps) {
  return (
    <div
      className={
        'grid grid-cols-1 gap-5 lg:block lg:columns-2 lg:-mb-5 ' +
        'lg:[&>*]:mb-5 lg:[&>*]:break-inside-avoid ' +
        className
      }
    >
      {children}
    </div>
  );
}
