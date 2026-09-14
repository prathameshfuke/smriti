/** Inert stub — see progress-share.ts for why. Same prop shape, renders nothing. */
export interface ProgressShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the documented prop-shape contract above
export function ProgressShareModal(_props: ProgressShareModalProps) {
  return null;
}
