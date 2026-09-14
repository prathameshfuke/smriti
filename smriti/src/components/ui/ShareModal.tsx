/**
 * Inert stub. The reference project's ShareModal posts a shareable score
 * card to social media — this app's own accessibility spec explicitly bans
 * performance comparison and social sharing for patient screens, so this
 * renders nothing rather than being wired up. Kept at the same import path
 * and prop shape so the copied game components don't need editing.
 */
export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the documented prop-shape contract above
export function ShareModal(_props: ShareModalProps) {
  return null;
}
