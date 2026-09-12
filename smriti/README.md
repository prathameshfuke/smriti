This is the **SMRITI** Next.js app. For the project overview, features, architecture, and full documentation, see the [root README](../README.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI Companion Setup

The Memory Bank AI companion needs two free LLM provider keys in `.env.local` (see `.env.local.example`):

- `GROQ_API_KEY` — free at [console.groq.com/keys](https://console.groq.com/keys), no card required. Primary provider (`llama-3.1-8b-instant`).
- `OPENROUTER_API_KEY` — free at [openrouter.ai/keys](https://openrouter.ai/keys). Fallback provider if Groq is rate-limited or unavailable.
- `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project's Settings → API. Used only server-side by `/api/ai/complete` to write conversation logs on behalf of a kiosk-trusted patient device (which has no Supabase session of its own). **Never expose this to the browser or commit it.**

All AI features call through `src/lib/ai/llm-client.ts` — never call Groq/OpenRouter directly from a feature file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
