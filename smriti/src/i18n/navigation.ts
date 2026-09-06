/**
 * The reference project uses next-intl's locale-prefixed routing
 * (`@/i18n/navigation`'s `Link` rewrites hrefs to `/en/...`, `/hi/...`).
 * This app has no locale-segment routing — language is a patient-profile
 * setting, not a URL segment (see `src/lib/i18n/`) — so this re-exports
 * plain `next/link` under the same name/path.
 */
export { default as Link } from 'next/link';
