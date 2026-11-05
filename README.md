# PLCC Connect

Public member PWA for **Promised Land Christian Center** — sermons, events, prayer, giving, and more.

Part of the PLCC ecosystem alongside [PLCC Vault](../awc-vault-main) (admin back-office).

## Prerequisites

- Node.js 18+
- Supabase project (shared with PLCC Vault)

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (same tenant as Vault) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (RLS enforced) |
| `VITE_AUTH_REDIRECT_URL` | Optional Auth callback URL (default `{origin}/auth/callback`) |
| `VAULT_API_ORIGIN` | **Server-only** HTTPS origin of PLCC Vault (no path). Required for member identity verification. |
| `OPENAI_API_KEY` | OpenAI key for PLCC Assistant (primary; optional) |
| `VITE_GEMINI_API_KEY` | Gemini fallback for PLCC Assistant (optional) |

Member sign-in uses Supabase Email OTP on the Connect origin. Allow-list the callback URL under Supabase Auth → Redirect URLs.

Member identity is verified via same-origin `GET`/`PATCH /api/member-self` (Phase 1.5). Set `VAULT_API_ORIGIN` on the server. Sign-in supports email OTP and phone+password (`POST /api/auth-phone` → Vault). Pending members finish setup on Account (Vault auto-promotes to MEMBER). Approved members acknowledge the photography/media notice (stored on the member record) and can open Community, create/edit/delete own posts, @mention members, react to posts and comments, comment, and use Notifications. Auth recovers after app/tab switches; Live/Family Huddles remint tokens and keep the screen awake while in-call. Member routes and the PLCC Assistant client are code-split so public visitors do not download them on first paint.

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
npm run typecheck
```

## Database & admin

Connect does not ship migrations. Schema is owned by **PLCC Vault** — see [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md).

Staff manage sermons, visits, connect cards, and prayer requests in Vault or Supabase directly.

## Deploy

Configured for Vercel SPA routing via [`vercel.json`](vercel.json). Set the same env vars in your deployment dashboard.
