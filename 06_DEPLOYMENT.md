# SMRITI — Deployment Guide (Free Tier)

---

## 1. Infrastructure Overview

| Service | Tier | Purpose | Limits |
|---------|------|---------|--------|
| **Vercel** | Hobby (free) | Frontend hosting + API routes | 100GB bandwidth, 100K serverless invocations/mo |
| **Supabase** | Free | PostgreSQL + Auth + Realtime + Storage | 500MB DB, 1GB storage, 50K MAU |
| **GitHub** | Free | Source code + CI/CD trigger | Unlimited public repos |

**Total cost: $0/month** for pilot scale (~100 users)

---

## 2. Prerequisites

```bash
# Required tools
node >= 18.0.0
npm >= 9.0.0
git
npx supabase (Supabase CLI)

# Accounts needed (all free)
- GitHub account
- Vercel account (sign up with GitHub)
- Supabase account (sign up with GitHub)
```

---

## 3. Step-by-Step Setup

### 3.1 Create the Project

```bash
# Create Next.js project
npx create-next-app@latest smriti --typescript --tailwind --app --src-dir --use-npm
cd smriti

# Install dependencies
npm install dexie dexie-react-hooks         # IndexedDB (offline storage)
npm install @supabase/supabase-js           # Supabase client
npm install @supabase/ssr                   # Supabase server-side
npm install zustand                         # State management
npm install recharts                        # Charts for dashboard
npm install next-pwa                        # PWA support
npm install lucide-react                    # Icons
npm install uuid                            # UUID generation
npm install @types/uuid -D                  # UUID types

# Initialize git
git init
git add .
git commit -m "Initial SMRITI setup"
```

### 3.2 Set Up Supabase

```bash
# 1. Go to https://supabase.com/dashboard
# 2. Click "New Project"
# 3. Name: smriti
# 4. Database password: (generate and save securely)
# 5. Region: Mumbai (ap-south-1) — closest to NER
# 6. Click "Create new project"

# 7. Once created, go to Settings > API and note:
#    - Project URL: https://xxxx.supabase.co
#    - anon/public key: eyJhbGc...
#    - service_role key: eyJhbGc... (keep secret!)

# 8. Run the migrations (from 03_DATABASE.md):
#    Go to SQL Editor in Supabase Dashboard
#    Paste and run Migration 001 (core tables)
#    Paste and run Migration 002 (RLS policies)
#    Paste and run the alert function

# 9. Enable Auth providers:
#    Authentication > Providers > Email (enable, disable confirm email for dev)
#    Optionally: Phone (Twilio integration for OTP)
```

### 3.3 Configure Environment Variables

```bash
# Create .env.local (NOT committed to git)
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF

# Add .env.local to .gitignore (should already be there)
echo ".env.local" >> .gitignore
```

### 3.4 Configure PWA

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withPWA(nextConfig);
```

```json
// public/manifest.json
{
  "name": "SMRITI - Cognitive Care",
  "short_name": "SMRITI",
  "description": "AI-powered cognitive gaming for elderly dementia care",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#8B6914",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 3.5 Deploy to Vercel

```bash
# 1. Push to GitHub
git remote add origin https://github.com/your-username/smriti.git
git push -u origin main

# 2. Go to https://vercel.com/dashboard
# 3. Click "Add New Project"
# 4. Import your GitHub repo: smriti
# 5. Framework: Next.js (auto-detected)
# 6. Add environment variables:
#    NEXT_PUBLIC_SUPABASE_URL = (your Supabase URL)
#    NEXT_PUBLIC_SUPABASE_ANON_KEY = (your anon key)
#    SUPABASE_SERVICE_ROLE_KEY = (your service role key)
# 7. Click "Deploy"

# Vercel auto-deploys on every push to main
# Your app is now live at: https://smriti-xxxx.vercel.app
```

### 3.6 Set Up Custom Domain (Optional)

```bash
# In Vercel dashboard:
# Settings > Domains > Add: smriti.yourdomain.com
# Add CNAME record in your DNS: smriti -> cname.vercel-dns.com
```

---

## 4. CI/CD Pipeline

Vercel handles this automatically:
- Every push to `main` → production deployment
- Every pull request → preview deployment with unique URL
- Build logs visible in Vercel dashboard

### Recommended branch strategy:
```
main           → Production (auto-deploy)
develop        → Preview environment
feature/*      → Feature branches (preview on PR)
```

---

## 5. Database Migrations Workflow

```bash
# For production changes to Supabase schema:

# 1. Write migration SQL in supabase/migrations/003_your_change.sql
# 2. Test locally using Supabase CLI:
npx supabase db reset  # Resets local DB and runs all migrations

# 3. Apply to production:
#    Go to Supabase Dashboard > SQL Editor
#    Paste and run the migration
#    (Supabase free tier doesn't support CLI-based migrations to cloud)
```

---

## 6. Monitoring (Free)

| What | Tool | How |
|------|------|-----|
| Frontend errors | Vercel Analytics (built-in) | Auto-enabled |
| API latency | Vercel Functions logs | Dashboard > Deployments > Functions |
| Database health | Supabase Dashboard | Database > Health |
| PWA install rate | Custom telemetry event | Log to Supabase on install prompt |
| Sync failures | Client-side error logging | Log to `sync_errors` table |

---

## 7. Backup Strategy

```bash
# Supabase free tier doesn't include point-in-time recovery
# Implement manual backup routine:

# Weekly: Export critical tables
# Supabase Dashboard > Table Editor > Export as CSV

# Or use pg_dump via connection string:
pg_dump "postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres" \
  --data-only --table=patients --table=daily_summaries \
  > backup_$(date +%Y%m%d).sql
```

---

## 8. Scaling Beyond Free Tier

| Trigger | Action | Cost |
|---------|--------|------|
| >50K MAU on Supabase | Upgrade to Pro ($25/mo) | $25/mo |
| >100GB bandwidth on Vercel | Upgrade to Pro ($20/mo) | $20/mo |
| Need custom domain email auth | Add SendGrid/Resend integration | Free tier available |
| Need push notifications | Add Firebase Cloud Messaging | Free |
| >500MB database | Supabase Pro or clean up old telemetry | $25/mo |

**For hackathon/pilot (0-500 users): free tier is sufficient.**

---

## 9. Testing the PWA

```bash
# Local development
npm run dev
# Open http://localhost:3000

# Test PWA features:
# 1. Open Chrome DevTools > Application tab
# 2. Check "Service Workers" registered
# 3. Check "Manifest" detected
# 4. Check "Cache Storage" populated
# 5. Toggle "Offline" in Network tab — app should still work

# Test on real device:
# 1. Deploy to Vercel (need HTTPS for PWA)
# 2. Open on Android Chrome
# 3. "Add to Home Screen" prompt should appear
# 4. App launches in standalone mode (no browser chrome)
# 5. Test with airplane mode — games should work
```

---

## 10. Environment Checklist

```
[ ] GitHub repo created and pushed
[ ] Supabase project created (Mumbai region)
[ ] Supabase tables created (Migration 001)
[ ] Supabase RLS policies applied (Migration 002)
[ ] Supabase Auth enabled (Email provider)
[ ] Vercel project connected to GitHub
[ ] Environment variables set in Vercel
[ ] First deployment successful
[ ] PWA manifest validated (Lighthouse)
[ ] Offline mode tested
[ ] Service Worker caching verified
[ ] Custom domain configured (if applicable)
```
