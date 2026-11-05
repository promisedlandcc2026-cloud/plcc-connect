# PLCC Connect Ecosystem

PLCC Connect is the **public member PWA**. [PLCC Vault](../awc-vault-main) (separate repo) is the **admin back-office**. Both apps share one Supabase project.

## Schema ownership

All database migrations live in **PLCC Vault**:

```
awc-vault-main/supabase/migrations/
```

Run migrations in the Supabase SQL editor or via Vault's migration scripts. Connect does not ship its own migrations.

**Master sync file for Connect-facing tables:**

`awc-vault-main/supabase/migrations/AWC_FULL_DATABASE_SYNC.sql`

## Connect-facing tables

| Table | Connect usage |
|-------|---------------|
| `sermons` | Message Guide / Sermon Notes |
| `daily_inspiration` | Optional admin override for Today's Word on the bulletin |
| `events` | Upcoming Events |
| `event_registrations` | Event RSVP |
| `announcements` | Announcements |
| `teams` | Ministries / Join Team |
| `team_applications` | Join Team form |
| `prayer_requests` | Prayer Wall |
| `connect_cards` | Connect Card form |
| `visit_registrations` | Plan a Visit form |
| `giving_settings` | Give module |
| `giving_intent` | Give intent tracking |
| `videos` | Watch Live |
| `vault_news` | Member Home Vault News (read; staff post via Connect/Vault API) |
| `event_run_of_show` | Sunday live Home order of service (read: title, time, duration only) |
| `attendance_plans` | Home ticket "I'll be there" (self-only RLS; SQL in `docs/supabase/connect_attendance_plans.sql`, apply in Vault/Supabase) |

## Admin workflows (Vault only)

| Public Connect action | Vault admin page |
|----------------------|------------------|
| Plan a Visit | People → Plan a Visit |
| Connect Card | People → Connect Cards |
| Join Team | People → Teams |
| Sermon data | Supabase `sermons` table (see SOP below) |
| Prayer requests | Community → Prayer Wall |

## Sermon data SOP

See [sermon-data-sop/requirements.md](../.kiro/specs/sermon-data-sop/requirements.md) for how staff add sermon records to Supabase.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `VITE_SUPABASE_URL` — same project as Vault
- `VITE_SUPABASE_ANON_KEY` — public anon key (RLS enforced)
- `VITE_AUTH_REDIRECT_URL` — optional; Connect Auth callback (defaults to `{origin}/auth/callback`)
- `VAULT_API_ORIGIN` — **server-only**; HTTPS origin of Vault (e.g. `https://plcc-opal.vercel.app`). Used by `GET /api/member-self`. Never put this under `VITE_`.
- `OPENAI_API_KEY` — optional; primary provider for the PLCC Assistant (Vite client build; see `envPrefix`)
- `VITE_GEMINI_API_KEY` — optional; Gemini fallback if OpenAI is unset or fails

Never put service-role keys in Connect.

## Member authentication (Phase 1)

Connect uses the same Supabase Auth tenant as Vault. Sessions live on the **Connect origin only** (no cross-domain SSO). Visitor mode remains fully public.

**Sign-in channels:**
- **Email OTP** — one-time code / magic link (unchanged).
- **Phone + password** — same as Vault’s live phone path via same-origin `POST /api/auth-phone` → Vault `resource=auth-phone` (no SMS text codes). Phone-only accounts use Vault’s internal `@phone.awcvault.invalid` Auth email; Connect never shows that placeholder.

Account → Security manages optional **2-Step Auth (TOTP)** via Supabase Auth client APIs — **no Vault security bridge**. TOTP factors live on the shared Auth user (Vault enrollments appear as Connected). Email OTP is not 2-Step Auth. Connect does **not** force an AAL2 challenge after OTP (parity with Vault login today). **Passkeys are not offered on Connect** while Vault and Connect use sibling `*.vercel.app` hosts (they cannot share a WebAuthn RP ID); passkeys remain available in Vault Settings.

**Session stickiness:** AuthContext recovers on `visibilitychange` / `online` and only clears the session on fatal refresh errors. Bridge clients use `getValidAccessToken()` (refresh near expiry; one 401 retry). Live/Family Huddles auto-remint and reconnect after background disconnects (capped retries) and request a Screen Wake Lock while in-call.

## Member identity bridge (Phase 1.5)

Authenticated browsers call same-origin `GET /api/member-self` with their Supabase Bearer token. Connect forwards that token only to Vault `GET /api/vault?resource=users&self=true`, then returns a sanitized identity DTO (`id`, `name`, `email`, `avatarUrl`, `role`, `approvalStatus`, `mediaNotice`). No general-purpose Vault proxy.

**Self-service approval:** Pending members use Account → **Complete setup**, which calls `PATCH /api/member-self` with `{ action: "complete_onboarding" }`. Connect merges `notification_prefs.onboarding.completedAt` on Vault; Vault auto-promotes `PENDING` → `MEMBER`. Staff can still change roles in Vault.

**Photography & media notice:** Approved members see a sticky modal until they acknowledge. `PATCH /api/member-self` with `{ action: "acknowledge_media_notice" }` saves `notification_prefs.mediaNotice` (`acknowledgedAt` + version). “Not now” is session-only and reappears on the next sign-in. Status appears on Profile → Acknowledgements. Only these two PATCH actions are allowed; arbitrary prefs blobs are rejected.

## Community feed (Phase 2 — read-only)

Approved members open `/community`, which loads `GET /api/community-feed`. Connect forwards the Bearer token only to Vault `GET /api/vault?resource=community&subResource=feed&feedType=posts` with validated `limit`/`offset`. The browser never queries Community tables directly. Later phases add posting, comments, and reactions via additional narrow bridges.

## Member notifications (Phase 3 — in-app inbox)

Signed-in members (including pending / phone-only accounts) open `/notifications`, which uses same-origin `GET`/`PATCH /api/member-notifications`. Connect forwards the Bearer token only to Vault `GET`/`PATCH /api/vault?resource=notifications`. Vault enforces per-user ownership. Connect maps destinations safely (Community → `/community`; Vault News → `/?section=vault-news`; admin/chat/huddle links are never opened). Vault News posts fan out as `announcement` + `/dashboard` to every `users` row (including `@phone.awcvault.invalid`); Connect labels those as Vault News and lights the bell. No push, no second notification table.

## Community post deep links (Phase 3.5 — read-only)

Community notifications with a safely resolved post ID open `/community/post/:postId`. Connect loads `GET /api/community-post?id=<uuid>`, which forwards only to Vault `GET …/feed&feedType=posts&id=<uuid>`. Comment/mention-comment notifications use Vault’s feed link pattern to recover the parent post ID (`source_id` is the comment id). Feed cards also open the focused post view. Posting, comments, and reactions remain out of scope.

## Community reactions (Phase 4)

Approved members can toggle Vault reactions (`love`, `pray`, `praise`, `like`) via `POST /api/community-reaction` → Vault `POST …/feed&feedType=reactions` with `{ targetType: 'post', targetId, reaction }` (legacy Connect body `{ postId, reaction }` still accepted). Same reaction toggles off; different reactions may coexist per Vault’s uniqueness model. Connect does not create reaction notifications (Vault defers them).

## Community comments (Phase 5)

Focused posts load `GET/POST/PATCH/DELETE /api/community-comments`, forwarding only to Vault `…/feed&feedType=comments`. Members may create comments and edit/delete **their own** only (moderator remove is never exposed). Vault list is newest-100 chronological with no offset. Comment notifications can deep-link to `/community/post/:postId?comment=:commentId`. Mention autocomplete remained deferred until Phase 8.

## Community post creation (Phase 6)

Approved members create posts from `/community` via `POST /api/community-posts` → Vault `POST …/feed&feedType=posts` with `category` forced to `general`. Optional single image uses Vault’s JSON `{ mimeType, fileBase64 }` contract (JPG/PNG/WebP; magic-byte checked; no client storage paths). Vault owns author identity, storage under `community-files`, mentions, and notifications. Post edit/delete and mention autocomplete remain deferred.

## Community post self-management (Phase 7)

Approved members edit or delete **their own** posts via `POST /api/community-post-manage`. Connect verifies Vault self-user ID against the post author ID before every mutation (so Vault moderator delete rights never become Connect moderation). Edit is **text-only** — Vault’s PATCH does not replace/remove images. Delete soft-removes the post in Vault. Pin/unpin and moderating others’ posts are never exposed.

## Community @mentions (Phase 8)

Approved members search mention candidates via `GET /api/community-mentions?q=` → Vault `…/feed&feedType=mention-candidates`. Connect strips Vault `role` / `emailHint`, requires a non-empty bounded query (no empty directory browse), and inserts Vault’s `@[Name](mention:uuid)` tokens. Posts and comments display as `@Name` without exposing UUIDs. Vault parses tokens and sends notifications; Connect does not send `mentionedUserIds` or create notification rows.

## Community comment reactions (Phase 9)

The same `POST /api/community-reaction` bridge accepts `{ targetType: 'comment', targetId, reaction }`. Vault verifies Community eligibility at the feed gate, rejects soft-deleted comments, and cascades comment soft-delete when a parent post is removed. Reaction summaries on comment lists include `reactedByMe`. Connect keys viewer reaction state by `post:` / `comment:` so IDs cannot collide, clears overlays on sign-out / account change / comment or parent-post delete, and never creates reaction notifications.

## Community chat + Live Huddle

Approved members open `/community/chat` for Vault text channels (ACL filtered upstream) and direct messages. Bridge: `GET|POST /api/community-chat?resource=channels|messages|unread|huddle-status|huddle-token|huddle-end|directory|dm` → fixed Vault chatTypes (`channels`, `messages`, `unread-count`/`mark-read`, `voice-huddle-statuses`, `voice-token`, `voice-huddle-end`, `mentors`, `dm-channel`). Connect sanitizes channels/messages (drops attachments, reaction user lists, privileged fields) and huddle payloads (`live`/`participantCount`; token `{ token, url, roomName, expiresIn, canModerate, channelId, channelName }` only). Directory search requires a non-empty `q` and returns `{ id, name, avatarUrl }` only (no email/role). DMs are get-or-create via `partnerId`; Vault excludes DMs from the channels list, so Connect keeps recent DMs on-device. Chat text polls ~5s; LIVE badges poll ~10s. Members may **start or join** Live Huddles on non-DM channels (token mint creates the room); moderators may **end** via `huddle-end`. Connect never stores `LIVEKIT_API_SECRET` and does **not** expose `voice-huddle-mod`. `community_huddle_started` notifications deep-link to `/community/chat/:channelId`. Out of scope: creating group channels from Connect, attachments, channel admin, host pass/add, Vault AI send path.

## Family + Family Huddle

**My Family** (`/family`) is read-only: Connect calls Supabase RPC `get_my_family_summary` with the member session JWT and sanitizes the result. Connect **never** receives household UUIDs, guardian credentials, or check-in flags—only display names, relationships, and opaque dependent `cardRef` when authorized. Guardians open **View Child Card** → `/family/card/:cardRef` via RPC `get_my_guardian_child_cards`. After applying `docs/supabase/connect_dependent_card_access_code.sql` (Vault/Supabase), the child card may include an optional 4-digit desk/kiosk `accessCode` (shown as **Check-in code**; not pickup authorization).

**Kids Plans** (`/kids-plans`) is a **read-only** archive for approved members who are kids ministry staff **or** verified guardians. Bridge: `GET /api/kids-plans` → Vault `GET /api/vault?resource=kids-plans` (optional `year` / `classroom`). Connect sanitizes to `{ id, serviceDate, classroom, title, notes, fileName, contentType, signedUrl }` (no `uploadedBy`, no delete). **Uploads stay in Vault** (Events → Kids Plans). Prerequisite migration on the shared Supabase project: `create_kids_ministry_plans.sql` (table + private `kids-ministry-plans` bucket). Vault GET allows active guardians; POST/DELETE remain staff-only.

**Family Huddle** is a private LiveKit room for **verified household adults** plus optional **guest invite links** (copy / WhatsApp share; no email). Vault owns LiveKit secrets and membership:

- Room prefix: `awc-family-{householdId}` (parallel to community `awc-channel-…`).
- Vault API: `resource=family&subResource=huddle` with `huddleType=status|token|end|invite-create|invite-redeem|invite-lock`. Household is resolved **server-side from the caller JWT**; clients never send `householdId`.
- Invites: opaque token (store SHA-256 hash), **2h expiry**, max uses (10), lockable. Guests redeem with `{ token, displayName }` (no church account); redeem does **not** add them to `household_members`.
- Dependents / children are listed on My Family but are **not** LiveKit participants in v1. No recording.

Connect Hobby bridge pressure: top-level `api/*.js` count is **15** (includes `auth-phone`, `kids-plans`, and `vault-news`). `GET|POST /api/family-huddle?resource=…` also hosts the former `latest-youtube` handler under `resource=youtube`. Public `/api/latest-youtube` is preserved via Vercel rewrite. `GET /api/vault-health` rewrites to `vault-news?probe=health` so database health does not consume a second function. Sanitize strips LiveKit secrets and household UUIDs. UI: LIVE badge + start/join/share/end on My Family; public `/family/huddle/join?code=…` for guests.

Out of scope (v1): email invites, recording, dependents on camera, auto-adding invitees to household, scheduling, `voice-huddle-mod` host-pass (any household adult may end).

## Kids View + PLCC Bucks (read-only)

Household adults open `/family/kids/:cardRef` from a child row on My Family (same guardian `cardRef` as `/family/card/:cardRef`). It is the Vault Kids View (Soft Garden / Adventure theme, streak, badges, level, check-in QR) plus the child's **PLCC Bucks** wallet.

- Bridge: `GET /api/family-huddle?resource=kids-view&cardRef=AWCD.…` → Vault `resource=family&subResource=dependents&action=kids-view&cardRef=`; `POST ?resource=kids-theme { cardRef, kidsTheme }` → Vault `action=kids-theme` (PATCH, theme only). No new `api/*.js`, no SQL.
- Vault resolves `cardRef` through `dependent_digital_cards`, keeps the household child check, and omits `child.id`. `api/_utils/kidsViewSanitize.js` is a fail-closed whitelist (no member, household, or ledger UUIDs).
- PLCC Bucks are **awarded only by leaders on Vault** (`resource=kids-bucks`). Connect has no award, reverse, or caps UI. Wallet is hidden when Vault returns `bucks: null` (migration not run). Adult check-in points (`/points`) are separate and are not PLCC Bucks.

## Vault News + database health

Approved members see **Vault News** on Home (`#vault-news`) — the same `public.vault_news` feed as Vault Dashboard. Bridge: `GET|POST /api/vault-news` → Vault `resource=vault-news` (Bearer). Pastor / Ministry Leader / Super Admin may post from Connect; Vault still enforces those roles. Visitors do not see this feed (Vault RLS is authenticated-only).

**Database health** is Vault’s public `resource=health` probe (users `id` limit 1). Connect exposes same-origin `GET /api/vault-health` (rewrite onto `vault-news?probe=health`). The probe is unauthenticated and **always HTTP 200** with `{ ok: true, database: 'healthy' | 'unavailable' }` so Home can still render during an outage. Connect never embeds Vault Repair.

## Performance / code splitting (Phase 10)

Public home keeps Welcome + Home eager. Member Sign In, Auth Callback, Account, Community (providers + feed + post), and Notifications load via `React.lazy` behind `MemberGate` and branded `LazyRoute` fallbacks. Community reaction/post-sync providers mount only inside the Community layout. The PLCC Assistant client (OpenAI primary, Gemini fallback) loads only when the assistant sends a message. Approved-member header links may prefetch JS chunks on focus/hover when the connection is not constrained.

## Check-in points + seasonal theme

Same features as PLCC Vault, with **all point rules, the ledger, and QR signing kept in Vault** (`api/_utils/checkinPointsHandler.ts`, `memberPassHandler.ts`). The shared Supabase project already has `member_point_ledger`, `member_points_settings`, `attendance_sessions.points_enabled`, and the `attendance_self_checkin` / `points_leaderboard` / `points_member_summary` / `award_points_for_session` functions — **Connect ships no SQL** for this.

**Bridge:** `GET|PATCH|POST /api/checkin-points?resource=…` rewrites onto `vault-news?bridge=points` (no new serverless function). Connect forwards the member Bearer token only to fixed Vault URLs:

| Connect `resource` | Method | Vault |
|---|---|---|
| `my-points` | GET / PATCH `{ showOnLeaderboard }` | `attendance` → `my-points` |
| `leaderboard` | GET | `attendance` → `points-leaderboard` |
| `self-check-in` | POST `{ code }` | `attendance` → `self-check-in` |
| `member-pass` | GET | `people` → `member-pass` (caller's own pass; Connect never sends `memberId`) |
| `season` | GET | `settings&scope=system` → returns **only** `seasonal` (always HTTP 200; visitors get the last church setting cached on the device, else `automatic`) |

Leader routes (`self-qr`, points on/off) are never exposed from Connect. Responses are whitelisted (`api/_utils/checkinPointsSanitize.js`); the pass returns only `{ qrPayload, accessCode }`.

**UI:** Profile → points card (**Show my QR** opens the membership QR; **Scan the room code** opens `/scan-in`) with the leaderboard opt-out. Member Home → season leaderboard (top 10, first name + last initial) with **My QR** and **Scan the room code**. `/scan-in` scans the leader's rotating QR with the on-device camera (`@yudiel/react-qr-scanner`, lazy chunk) and also accepts `/scan-in?c=TOKEN`.

**Seasonal theme:** `lib/seasons/*` and `components/season/SeasonParticles.tsx` mirror Vault (Fall/Winter/Spring/Summer + Thanksgiving, Christmas, New Year, Easter, church anniversary; Africa/Kampala). `SeasonThemeProvider` sets `<html data-season>` so the `--season-*` variables in `index.css` apply; the home hub shows the seasonal wash, "Welcome home" chip, holiday greeting, and the falling effect (off for reduced motion or when the church turns effects off). Keep these files in sync with Vault.

## Holiday RSVPs (Thanksgiving / Marrieds Dinner)

Mirrors Vault → Events & Check-In → Holiday RSVPs · 2026. `lib/holidayRsvps.ts` carries the Vault Fellowship Event Kit ids, dates and RSVP close times (`api/_utils/fellowshipEventConfig.ts` on Vault — keep in sync). Kit events get RSVP unless Vault sets `rsvp_enabled = false`, same rule as Vault's `runtimeConfigFromDbEvent`. The form itself (household, guests, allergy/injury consents, Pledge vs Pay Now) stays on Vault.

- Links use Vault **hash routes**: `https://plcc-opal.vercel.app/#/events/:id/rsvp` (and `/#/fellowship-cookout`). Stored Vault links without `#` are normalized.
- Home (members and visitors) features the nearest open sign-up from its `featureFrom` date until RSVP closes, with "RSVP by …" and a last-week countdown. Event details show "RSVP by …", then "RSVP closed".

## Member Home (Phase 1 redesign)

Burgundy top: greeting by first name + date, season chip, **Next up** (happening now / next calendar event / Sunday service fallback, with Details and Directions; "Live now" when the YouTube stream is live), and four quick actions: Give, My QR, Prayer, Watch. Feed order: install prompt, Sunday Mode, holiday sign-up, leaderboard, Upcoming, Community, Announcements, Vault News, Prayer, latest message, Watch, Ministries. Empty Community/Upcoming/Announcements sections hide themselves. The 8-tile hub, Today, and Notifications sections were removed from member Home (bottom bar + bell cover them); the public Home keeps the hub.

## Design kit (Phase 2)

Shared building blocks in `components/ui/` — use these instead of hand-styled markup:

| Component | Use |
|---|---|
| `Button`, `ButtonLink`, `ButtonAnchor` | Every tap target. Variants: primary, secondary (outline), subtle, ghost, danger, dark. Sizes sm 40px / md 48px / lg 56px. |
| `Card` | White rounded panel (`shadow-card`). |
| `ListRow`, `ListGroup` | Icon + title + subtitle rows in grouped cards (More, Profile tools, Home Ministries). |
| `SectionHeader` | Section titles with an optional "See all" link (Home feed via `MemberHomeSection`). |
| `LoadingState`, `SkeletonRows`, `EmptyState`, `ErrorState` | Readable states; EmptyState can offer a next action. |
| `MemberPageHeader` | Back link, optional eyebrow, serif page title, subtitle, optional right action. |

Rules: UI text is **12px minimum** (count badges 11px). Inter (400–900 loaded) for UI; Playfair only via `font-display` (page titles). Brand gold is for fills; gold text on light backgrounds uses `text-gold-ink`. Colors: `ink`, `ink-muted`, `ink-soft`. `scripts/test-design-kit.mjs` enforces the text floor.

**Assistant:** approved members open it from **Ask PLCC** in the Home header; visitors get a labeled launcher that stays out of the way at the top of the page and while scrolling down. It opens as a bottom sheet. Other screens can call `openAssistant()`.

**Watch → Next service** comes from the calendar (next worship/service event) or the next scheduled Sunday in `CHURCH_INFO` — no hardcoded time.

## Navigation (Phase 3): Me tab

Bottom bar: **Home · Community · Events · Prayer · Me** (the Me tab shows the member's photo when they have one, plus the unread badge). `/me` (`pages/MemberMore.tsx`, exported as `MemberMePage`; `MemberMorePage` kept as an alias) replaces More; `/more` redirects to `/me`.

Me = who you are (photo, name, **Edit** → `/profile`), the points card (Show my QR, Scan the room code, leaderboard switch), then grouped lists: **Mine** (My PLCC Card, Notifications, My Family, My Serving, My Attendance, Sermon Notes, Kids Plans), **Church life** (Give, Watch, Sunday Mode, Chat, Vault News, Ministries, Serve, Directory), **Account** (Edit profile, Settings, Open PLCC Vault for staff). Personal screens highlight Me and their back links return to Me. The Home header's account button opens Me for approved members.

**One PLCC Card:** the check-in QR (Vault member-pass) and My PLCC Card read the same `member_digital_cards.qr_token`, so they are one concept. "Show my QR" / "My QR" open the **My PLCC Card** sheet (QR + backup code + link to the full card); `/card` explains it is also the check-in QR, links to `/scan-in`, and keeps the screen awake.

## Live Huddle fail-safes (mirrors Vault, Oct 2026)

Connect now gets the same protection Vault added on Oct 14 (`huddleFallbackPass.ts`, `huddleProvider.ts`):

1. **Database down** — `huddle-token` passes Vault's signed 12-hour `fallbackPass` through (opaque). Connect keeps it on the phone (`awc_huddle_fallback_<channelId>`, same key as Vault). If minting fails with a server error or an unverifiable session, Connect calls `POST /api/community-chat?resource=huddle-token-fallback { channelId, fallbackPass }` → Vault `voice-token-fallback`, which opens LiveKit without Supabase. No Bearer needed on that route; the pass is the credential.
2. **LiveKit out of minutes** — `lib/livekitConnect.ts` (from Vault) turns a LiveKit 429 into `LiveKitQuotaError`. Connect then moves the huddle to the **backup line** (Daily) via `resource=huddle-daily-token` → Vault `voice-daily-token` (needs `DAILY_API_KEY` on Vault). Before joining, `resource=huddle-line` → Vault `voice-huddle-provider` says which line the channel is on, so Connect and Vault members always share a line; after a LiveKit join Connect claims `livekit` and follows Vault if the channel already moved. `DailyBackupHuddle` (lazy-loaded) is audio-first with roster, mute, raise hand (`awc.huddle.hand`, same as Vault) and leave.
3. **Hiccups** — a failed start retries twice (0.7s, 1.8s) before the fallback or a clear message.
4. **Database healthy badge** — re-checks every minute and when the app returns to the foreground; when unavailable it explains that huddles still open.

Tests: `scripts/test-huddle-failsafe.mjs`. Family Huddle has no Vault fallback yet, so it is unchanged.

## Accessibility (Phase 4)

An axe scan (WCAG 2.2 AA + best practice) of 17 member screens and the visitor Home/sign-in at phone size is clean. Rules kept by `scripts/test-accessibility.mjs`:

- Pinch-zoom stays on (no `user-scalable=no` / `maximum-scale=1`).
- Secondary text uses `gray-500` = `#636A77` / `ink-soft` (≥ 5.0:1 on white and eggshell). No `text-gray-300` text on light screens; on burgundy use `text-gold-light` or `text-white/75+`.
- Icon-only buttons need an `aria-label`; tap targets are at least 44px.
- Forms use `components/ui/Field.tsx` (`inputClass`, `LABEL_CLASS`): 52px fields, 16px text, visible focus ring.
- Community, Chat and sign-in use the shared header/button/field kit. Chat shows the member's name, never the internal phone-account email.
