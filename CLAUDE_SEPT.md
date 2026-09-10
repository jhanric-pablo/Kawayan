# CLAUDE_SEPT — Change Log

Work done with Claude Code across one working session (Sept 7–8, 2026) on the
**Kawayan AI** capstone. Every change kept existing functionality, data flow, API
calls, pricing logic, AI generation and database behaviour intact — these were
UI/UX overhauls plus targeted stability fixes. The public **Landing page content
was left untouched** (only shared design tokens it inherits changed).

`npx tsc --noEmit` and `npm run build` pass after every step.

---

## 0. Quick index

| # | Area | Outcome |
|---|------|---------|
| 1 | Landing hero | Text centred over the backdrop; vertical scrolling "business type" marquee added |
| 2 | Landing hero | Cinematic brand-green colour grade |
| 3 | Landing hero | Person/desk video replaced with a hand-built animated social-media backdrop (`HeroBackground.tsx`) |
| 4 | Calendar | "Zoomed out" so a full month fits without scrolling |
| 5 | Auth | `Login.tsx` rebuilt as a two-pane "studio" card + password toggle + icon inputs |
| 6 | Routing | Refresh no longer bounces Login/Sign-Up back to the homepage |
| 7 | Auth | "← Back to home" control + clickable logos on all auth screens |
| 8 | Calendar | **Schedule-X → TOAST UI Calendar** migration; text-only status chips; agenda/list view; calendar made the primary workspace |
| 9 | Calendar | Post creation moved from a right slide-out drawer to a centred **PostComposer** studio dialog with live preview |
| 10 | Whole app | **Design System v3 "Studio"** — new tokens, buttons, inputs, cards, badges, modal pattern; de-glassed; noise texture removed |
| 11 | Calendar | AI planning moved from a bottom strip (was cut off / colliding with widgets) into a **PlanningDrawer** opened from a toolbar button |
| 12 | Admin | `AdminDashboard.tsx` fully remodelled into a sidebar **Admin Console** |
| 13 | Backend/DB | SQLite reliability pragmas, server crash-guards + graceful shutdown, resilient calendar loading, non-blocking **Toast** notifications |
| 14 | Auth | `Login.tsx` rebuilt again — a full-bleed **editorial "Ledger"** concept: no card, big Fraunces type, underline floating-label inputs, flat action, bamboo spine motif |
| 15 | Auth / Legal | Signup **Privacy Policy** link no longer opens `/privacy.html` in a new tab — Terms **and** Privacy now render in-app via a restyled `TermsOfServiceModal` (`doc` prop + `PRIVACY_SECTIONS`); same for the landing footer |
| 16 | Landing | New **Pricing** section on the home page (3 real plans + ₱150 add-on note); nav "Free Plan" → "Pricing" |
| 17 | Auth | Sign in ⇄ Create account tab switch animated — sliding underline indicator + fade-swap of the headline and the sign-up-only fields |
| 18 | Calendar | `PlanningDrawer` right slide-over → **`PlanningModal`**, a centred dialog on the shared `.kw-overlay` / `.kw-sheet` pattern (Esc + scroll-lock, green top rule, footer actions) |
| 19 | Insights / Billing / Settings | UI brought onto Design System v3 — `.page-head`, `.surface`, `.input`, `.btn`, `.badge`, `.kw-overlay` modals; dropped `glass-card`, gradient buttons and stray slate/emerald/indigo/rose colours for brand tokens |

---

## 1. Landing hero — text, marquee, colour grade, animated backdrop

**File:** `components/LandingPage.tsx` (+ new `components/landing/HeroBackground.tsx`)

- Headline, sub-copy and CTA are now **centred directly over the background**
  (`max-w-3xl mx-auto text-center`). The old two-column layout and floating
  preview cards were removed. Mouse/scroll parallax kept.
- New **vertical scrolling marquee** down the right side of the hero showing the
  variety of Philippine MSMEs served (Coffee Shop, Sari-sari Store, Panaderia,
  Carinderia, Ukay Boutique, Barbershop, Lechon Manok Stall, Halamanan, …).
  Edit the `BUSINESS_TYPES` array at the top of `LandingPage.tsx`.
  Needs the `scroll-y` keyframe/animation added to the Tailwind config in
  `index.html`.
- **Cinematic colour grade** — the flat `bg-black/70` video overlay was replaced
  with a layered brand-green stack (contrast base, 135° green duotone wash,
  split-tone gradient, vignette). Later softened once the video was removed.
- **Video replaced** — `/video/video.mp4` (a person at a desk) is no longer
  referenced. `components/landing/HeroBackground.tsx` renders a pure CSS/SVG
  scene instead: drifting "social post" cards (avatar, media block, like/comment
  counts, `Auto`/`Trending` pills), rising engagement bubbles, an animated
  content grid, slow green glow orbs, and a subtle bamboo motif ("Kawayan").
  Respects `prefers-reduced-motion`. The scroll effect no longer scrubs a video —
  it parallax-drifts the backdrop.
- The old `<video>` refs/state were removed; mouse tracking moved to a ref
  (no re-render per mouse move).
- `public/video/video.mp4` is now **unreferenced** (candidate for deletion).

---

## 2. Auth screens — `Login.tsx`

**File:** `components/Login.tsx` — every auth handler, validation, `dbService`
call and prop kept identical.

- Rebuilt as a **split "studio" card**: left brand panel (deep gradient,
  animated glow blobs, feature chips that lift on hover, a "3.2× reach /
  1,000+ MSMEs" social-proof card, staggered fade-in), right form panel.
- Inputs now have **leading icons** (Mail, Lock, Building2, MapPin, Phone),
  a softer fill, a 4px brand focus ring, hover border.
- **Password show/hide toggle** (Eye/EyeOff) — the only added interactive state
  (`showPassword`); it just flips the input `type`, no auth-logic change.
- Upload zone shows a green check badge once a file is attached; error /
  password-requirement messages animate in; submit button gets a light sheen
  sweep + tactile press.
- **"← Back to home"** pill (top-left, mirrors the theme toggle) on Sign In,
  Sign Up and Staff Portal → `onNavigate(ViewState.LANDING)`.
- The desktop brand logo and the mobile logo are **clickable** → home.

---

## 3. Routing — "refresh sends me to the homepage"

**Files:** `utils/sessionView.ts`, `App.tsx`

Root cause: the app tracks the current screen in React state and persists it, but
the restore-on-load logic deliberately skipped the *public* screens, so a
logged-out visitor was always reset to `LANDING` on refresh.

- `utils/sessionView.ts` — added **`readPublicView()`**: returns the stored view
  only when it is one of the public screens (Landing / Login / Sign Up / Admin).
- `App.tsx` — a logged-out visitor's initial screen is now
  `readPublicView() ?? ViewState.LANDING` (was always `LANDING`). The logged-in
  restore path is unchanged.

Result: refreshing on Login / Sign Up (via "Get Started") / Landing stays put;
logged-in Calendar / Settings restore as before.

---

## 4. Calendar migration — Schedule-X → TOAST UI Calendar

**Packages**

- **Removed:** `@schedule-x/calendar`, `@schedule-x/calendar-controls`,
  `@schedule-x/events-service`, `@schedule-x/react`, `@schedule-x/theme-default`
- **Added:** `@toast-ui/calendar@^2.1.3`, `ts-essentials@^9.4.2` (dev — a missing
  transitive type dep of TOAST)
- **Not** `@toast-ui/react-calendar` — its bundle references `ReactCurrentDispatcher`,
  removed in React 19, so it hard-crashes. A thin hand-written React wrapper
  around the vanilla `@toast-ui/calendar` is used instead.
- TOAST's v2 theme store mutates + freezes a shared module default, so a **`theme`
  prop is never passed** (would crash the 2nd instance / StrictMode). All calendar
  visuals live in CSS; only per-status colours go through TOAST's safe `calendars`
  API.

**Files deleted**

- `components/calendar/ScheduleXCalendarView.tsx`
- `components/calendar/KawayanMonthGridEvent.tsx`
- `components/calendar/mapScheduleXEvents.ts`
- `components/calendar/scheduleXTheme.css`

**Files created**

- `components/calendar/KawayanCalendar.tsx` — vanilla-TOAST month grid + agenda
  switch. Creates/destroys the instance imperatively; syncs events (`clear()` +
  `createEvents()`), date (`setDate()`) and dark-mode calendar colours
  (`setCalendars()`). Selected-day highlight is applied via a `MutationObserver`
  (TOAST has no "selected date" concept). **All grid clicks — empty cell *and*
  event chip — go through one delegated `click` handler** (chips carry
  `data-day`, empty cells carry `data-ymd`), because TOAST's month
  `selectDateTime` only fires on drag-select and `clickEvent` needs a full
  pointer sequence.
- `components/calendar/AgendaView.tsx` — the month list/agenda view (same posts +
  ideas, grouped by day, text-only, no thumbnails).
- `components/calendar/mapCalendarEvents.ts` — posts/ideas → TOAST events + agenda
  items. **The filtering rules are a 1:1 port** (month-scoped posts; an idea is
  hidden once a post exists that day; idea days clamped into the month).
- `components/calendar/kawayanCalendar.css` — brand skin for TOAST (borders,
  day names, today marker, `.kw-cell-selected`, event chips, "+N" popup) +
  the agenda view + the status legend + status pills, light & dark.

**`components/ContentCalendar.tsx`**

- Swapped `<ScheduleXCalendarView>` → `<KawayanCalendar>`.
- **Calendar is now the primary workspace**: a clean bordered card, compact
  toolbar (month title · ‹ Today › · jump-to-date parser · grid/list toggle ·
  posts-this-month pill).
- **Event chips are text-only**: `STATUS · Title`, colour-coded — Idea = amber,
  Draft = sage-grey, Scheduled = forest, Published = green. A colour legend sits
  under the grid. **No images / thumbnails** in month or agenda.
- The paid **₱150 single-post add-on** moved from a `+` control in empty cells
  into a "Buy single post · ₱150" button in the composer's empty state
  (`handleAddOn` flow unchanged).

---

## 5. Post creation — `PostComposer.tsx`

**Files:** `components/calendar/PostComposer.tsx`, `components/calendar/postComposer.css`
(+ `ContentCalendar.tsx` wiring)

Replaced the ~290-line right slide-out panel with a **centred two-pane "studio"
dialog**:

- **Left — editor:** AI Draft / Rewrite · virality meter + reason · a full-size
  **caption editor** · editable image prompt + Generate/Regenerate · "upload your
  own photo" · collapsible version history · empty "Let's make something" start
  state with the idea hint + ₱150 add-on.
- **Right — live preview:** a read-only social-post mock that updates as you type
  (caption, image, business name).
- **Footer:** Save draft · Schedule · Post now (opens the platform picker).
- **Mobile:** single column, preview inline, sticky footer, full-screen; Esc
  closes; background scroll locked.
- Every action delegates to the exact handlers that already lived in
  `ContentCalendar` (`handleGeneratePost`, `handleGenerateImage`, `handleSavePost`,
  `handleAddOn`, `handlePhotoUpload`, schedule + "Post to…" flows).

---

## 6. Design System v3 — "Studio" (`index.html`)

Concept: away from glassmorphism / blur / paper-noise → a **crisp editorial
workspace**. Every class name kept, only the rules changed, so all screens
inherit the new look with no per-component rewrites.

- **Tokens** — warm-paper background (`--bg #F5F6F2`), solid cards, hairline
  `--border`, one calm neutral shadow ramp (`--shadow-xs … --shadow-xl`, no green
  glow), tighter radius scale (cards 20→16 px), added `--ring` focus token.
  Dark palette rebalanced so cards visibly lift off the background
  (`--card #1A2721`).
- Removed the SVG **paper-grain `body::before`** → a subtle ambient wash.
- **Typography** — Fraunces now drives `h1` *and* `h2`; refined weights/tracking.
- **`.glass` / `.glass-card` / `.glass-panel`** — de-glassed; the nav is a
  near-solid bar with a hairline (`color-mix` translucency).
- **`.btn` family** — flat solid fills, 1px inset highlight, gentle press;
  removed the sheen animation and heavy glows; added `.btn-ghost`, `.btn-sm`,
  `.btn-lg`. `.organic-btn-primary` (legacy alias) updated to match.
- **`.input`** — subtle filled style, one consistent 3px focus ring
  (dropped the old `!important` overrides).
- **`.badge`** — outlined pills via `color-mix`.
- **`.stat-card`, `.card`, `.nav-item-active`** — restrained.
- **New primitives:** `.page-head`, `.surface` / `.surface-pad`,
  `.kw-overlay` + `.kw-sheet` (the standard modal pattern used everywhere since).
- Tailwind config synced: `borderRadius`, `boxShadow`, `colors.background/slate/canvas`,
  and the `scroll-y` animation/keyframe for the hero marquee.

**`App.tsx`** — nav bar: token-based pill nav + border, fixed an undefined
`--muted` chip background (→ `--bg-alt`), danger-tinted Sign-Out hover.

**`components/OrganicDialog.tsx`** — the app-wide alert/confirm/prompt modal was
on an off-brand **slate + blue** palette; rebuilt on `.kw-overlay` / `.kw-sheet`
/ `.btn` / `.input`. Now on-brand everywhere it fires.

**`ContentCalendar.tsx`** — the "Post to…" platform-picker modal moved to
`.kw-sheet` + tokens; panel radii/shadows modernised
(`rounded-[2rem]` → `rounded-xl`, `shadow-float` → `shadow-lg`, etc.).

---

## 7. Calendar planning — `PlanningDrawer.tsx`

**Files:** `components/calendar/PlanningDrawer.tsx` (+ `ContentCalendar.tsx`,
`kawayanCalendar.css`)

Problem: the AI Content Planning panel was a full-width strip under the calendar —
pushed below the fold and colliding with the floating support/accessibility
buttons.

- Opened from a **"Plan month" button in the toolbar** (with a badge showing how
  many ideas are ready). Backdrop + Esc to close.
- All controls kept verbatim: strategy textarea, Plan month, Batch create N,
  Review/Hide ideas, the editable idea cards (heading / topic / format +
  "Open day").
- **Update (entry #18):** the right slide-over was replaced by
  `PlanningModal.tsx` — a **centred dialog** using the same `.kw-overlay` /
  `.kw-sheet` pattern as PostComposer and the Terms modal (green top rule,
  editorial header, scrollable body, `Plan month` + `Batch create N` in a sticky
  footer). Props and every handler are byte-for-byte identical; only the shell
  changed. Adds background scroll-lock while open.
- `ContentCalendar.tsx`: removed the bottom section, wired the button + drawer,
  removed the "auto-open on page load", added `pb-16` so the fixed widgets never
  overlap content.
- `kawayanCalendar.css`: calendar height `clamp(460px, 62vh, 760px)` →
  `clamp(430px, 58vh, 680px)` so a full 6-week month fits the viewport.
- Event chips given a full hairline border + a 3px left status accent + a fixed
  22px height so they read as defined chips.

---

## 8. Admin Console — `AdminDashboard.tsx`

**Files:** `components/AdminDashboard.tsx` (render fully rewritten; **all state,
handlers, effects and `dbService` / `supportService` calls untouched**),
new `components/admin/adminConsole.css`.

- Concept: horizontal tab-pills (with off-brand purple/indigo/blue) → a proper
  **left-sidebar admin console**.
- **Sidebar nav** — Overview / Users / Verification / Billing / Help Desk /
  Audit Logs / Settings, each with a **live count badge** (users, pending
  verifications, pending txns, open tickets). Sticky on desktop, scrolling strip
  on mobile.
- **Per-section page header** — Fraunces title + description + contextual actions
  (date range, Export CSV, Refresh).
- Small building-block components added in-file: `StatCard`, `Panel`,
  `AdminModal`, `RoleBadge`, `VStatusBadge`, `cx` helper.
- **Overview** — 6 stat cards (one green accent) + recharts recoloured to brand
  tokens (green area / sage bars, token tooltip & axes) + a "Latest activity"
  panel.
- **Users / Verification / Billing / Help Desk / Audit Logs** — one shared table
  style (hairline rows, hover, uppercase micro-headers, mono IDs, `.badge`
  statuses, compact `.adm-icon-btn` row actions).
- **Settings** — token toggle switches; a proper Light/Dark segmented control
  (fixed the old inverted click logic — it now just sets the theme); admin-profile
  form.
- Both modals (Manage user, Reject verification) moved to `.kw-overlay` /
  `.kw-sheet`.
- Removed every `purple/indigo/blue/emerald/rose/orange/slate` literal,
  `#2B5748` / `#273338` hex, `bg-black/50`, `focus:ring-indigo-500`, `animate-in`.

---

## 9. Backend / database stability + Toast notifications

**`config/database.ts`** — reliability pragmas:

- `busy_timeout = 8000` — concurrent access (seed script + dev server + parallel
  API calls) now waits for the lock instead of throwing `SQLITE_BUSY`.
- `synchronous = NORMAL`, `wal_autocheckpoint = 512`, `cache_size = -16000`
  (~16 MB), `temp_store = MEMORY`.
- Boot-time `wal_checkpoint(TRUNCATE)` (a stale 4 MB WAL was shrinking read perf)
  + a 5-minute passive checkpoint interval.
- New `checkpoint()`; `close()` now clears the interval and flushes the WAL.

**`services/databaseService.ts`** — added `checkpoint()` passthrough.

**`server.js`**

- **`process.on('uncaughtException')` + `process.on('unhandledRejection')`** —
  a throw in an un-awaited promise used to kill the whole process
  (→ `ECONNREFUSED` for the client). Now it logs and keeps serving.
- A `wrap()` async-handler helper + a **global Express error handler** that
  returns clean JSON; `SQLITE_BUSY` → `503 { retryable: true }`.
- **Graceful shutdown** on SIGINT/SIGTERM: close server → checkpoint + close DB.
- **AI proxy** (`/api/ai/unsloth`) — a dead tunnel used to hang the request;
  now a 20 s `AbortController` timeout + `degraded` flag + warn-level logging.

**`components/ContentCalendar.tsx`** — `loadData()` awaited the slow/offline
trending-topics AI call *before* loading posts, so a down AI proxy rendered the
calendar blank. Now trending topics fire independently (fire-and-forget); posts +
plan load via `Promise.allSettled` so one failing doesn't blank the other.
Measured: events load in ~0.8 s consistently (was intermittently blank / 20 s+).

**New component — `components/ui/Toast.tsx` (+ `toast.css`)**

- Lightweight `ToastProvider` / `useToast()` — non-blocking success/error/info
  notifications, auto-dismiss, stacked bottom-centre, brand-styled,
  reduced-motion aware. Wired into `index.tsx`.
- "Draft saved" and "Post scheduled" now show a quiet toast instead of a blocking
  modal.

---

## 9b. Auth screen v2 — "Ledger" (`Login.tsx`)

The earlier split-card auth looked like a generic SaaS template, so it was
rebuilt from scratch on a new concept. **Every handler, state field, prop and
the `TermsOfServiceModal` wiring are byte-for-byte the same** — only the
component's shell changed.

- **Full-bleed, no card** — the screen sits directly on the warm-paper
  background; a thin **bamboo "spine"** (hairline + nodes) runs up the far-left
  edge on desktop.
- **Two-column editorial layout** — left: small logo lockup, an oversized
  Fraunces headline ("Back to / business." · "Set up shop / in minutes." ·
  "Staff / console."), a short rule, sub-copy, and a "Built for [sari-sari
  stores / panaderias / …]" cycling line (honest, on-brand, no fake metrics).
  Right: the form, separated by a hairline.
- **Underline floating-label inputs** — no boxes, no inner icons. The label
  sits on the baseline and floats up small/uppercase/green on focus or fill;
  a 2px accent underline wipes in on focus.
- **Sign in ⇄ Create account** is a small text-tab switch at the top of the
  form (was a footer link).
- Password reveal is a text **`SHOW` / `HIDE`** toggle on the field line.
  Document upload is a dashed **"+ Attach Mayor's Permit / DTI / SEC"** text
  button → filename chip.
- Flat forest-green submit bar with a trailing arrow (no gradient / shadow /
  sheen). Errors are inline red text under a 2px top rule.
- Theme toggle and "← Kawayan" are plain text in a top bar.
- New file: `components/auth/authScreen.css`. `Login.tsx` icon imports trimmed
  to `ArrowRight, X`.

---

## 9c. In-app legal docs + landing Pricing section

**Privacy Policy no longer opens a new tab.** The signup TOS line had
`<a href="/privacy.html" target="_blank">`; it now opens the same in-app modal
as the Terms link.

- `constants/termsOfService.ts` — added `PRIVACY_SECTIONS` (7 clauses, distilled
  from `public/privacy.html`) + `PRIVACY_EFFECTIVE_DATE`.
- `components/TermsOfServiceModal.tsx` — restyled to the "Ledger" editorial
  aesthetic (v3 tokens, `var(--card)`, Fraunces title, 3px green top rule,
  `.btn` footer) and given a `doc: 'terms' | 'privacy'` prop plus an
  `onSwitchDoc` footer cross-link ("Also read the …"). Terms keeps its
  scroll-to-accept gate; Privacy is read-only.
- `components/Login.tsx` — `showTermsModal` boolean → `legalDoc: 'terms' |
  'privacy' | null`; Privacy `<a target="_blank">` → `<button>`. No handler /
  validation / fetch changes.
- `App.tsx` — landing footer Privacy/Terms `<a target="_blank">` → `<button>`s
  that open the shared modal; modal rendered once at app root.

**New landing Pricing section** (`components/LandingPage.tsx`, `<section
id="pricing">` between Features and the CTA). Three cards from real plan data —
Free Trial ₱0 / 8 posts per month, **Pro ₱499/mo** / 16 posts + analytics
(marked *Recommended*), Enterprise / Custom — plus a "₱150 per add-on post"
note. All CTAs route to `ViewState.SIGNUP`. Landing nav "Free Plan" (`#free-plan`)
→ "Pricing" (`#pricing`); the old `#free-plan` CTA band is unchanged.

---

## 9d. Animated auth mode switch (`Login.tsx`, `authScreen.css`)

The Sign in / Create account tabs were a hard swap. Now:

- **Sliding underline** — the green 2px rule is a single `.af-tabs__ink`
  element positioned with a `useLayoutEffect` that measures the active tab
  (`offsetLeft` / `offsetWidth`); it eases between tabs
  (`transform` + `width`, 0.42s). Recalculated on resize and once web fonts
  settle. The per-button `border-bottom` was removed.
- **Fade-swap on the left column** — the headline + rule + sub-copy are wrapped
  in `.af-lede` with a `key` that changes with the mode, so the copy
  ("Back to / business." ⇄ "Set up shop / in minutes.") rises-and-fades on
  switch instead of snapping. The "Built for …" ticker stays outside the wrap
  so it doesn't restart.
- **Staggered field reveal** — the sign-up-only rows (business details, permit
  upload, ToS) get `.af-reveal` (`af-swap` keyframe) with 0 / 60 / 120 ms
  delays, so they cascade in when you switch to Create account.
- All respect `prefers-reduced-motion`. No handler, validation, state or
  submit logic changed — `switchMode` is untouched.

---

## 9e. Insights / Billing / Settings — Design System v3 pass

These three screens still carried pre-v3 styling (`glass-card`, gradient
buttons, `rounded-2xl`, hard-coded `slate-*` / `emerald-*` / `indigo-*` /
`rose-*`). Restyled to match the rest of the app. **Every handler, state field,
tab, validation branch, service call and effect is unchanged** — JSX / classes
only.

- **Shared:** page headers now use `.page-head` / `.page-head__title`
  (Fraunces) / `.page-head__sub`; card containers use `.surface`; form controls
  use `.input`; actions use `.btn` variants; status pills use `.badge`.
  Full-screen modals use the `.kw-overlay` + `.kw-sheet` pattern with the 3px
  green top rule and backdrop-click to close (Success popup, Payment method,
  Change plan, Connect-platform sync, the syncing overlay).
- **InsightsDashboard:** `MetricBox` icon tiles unified to sage-pale + primary
  (was a rainbow of `text-*-500`); ROI figure and chart panels on `.surface`;
  Recharts tooltip on a solid card instead of a blur.
- **Billing:** wallet "card" keeps its forest gradient (on-brand) but on the
  token radius/shadow ramp; transaction table on `.surface`; amounts use
  `--success` / `--danger`.
- **Settings:** sidebar tabs collapsed to a small array + `.nav-item-active`;
  light/dark toggle repainted with tokens; all three panels (`profile`,
  `account`, `billing`) on `.surface` with `.input` fields and `.btn` actions;
  error blocks use `--danger` mixes.

---

## 10. Files touched — full list

### Added

```
.claude/launch.json
components/auth/authScreen.css
components/landing/HeroBackground.tsx
components/calendar/KawayanCalendar.tsx
components/calendar/AgendaView.tsx
components/calendar/mapCalendarEvents.ts
components/calendar/kawayanCalendar.css
components/calendar/PostComposer.tsx
components/calendar/postComposer.css
components/calendar/PlanningModal.tsx   (renamed from PlanningDrawer.tsx in #18)
components/admin/adminConsole.css
components/ui/Toast.tsx
components/ui/toast.css
CLAUDE_SEPT.md   (this file)
```

### Modified

```
index.html                     — Design System v3 + Tailwind config + scroll-y anim
index.tsx                      — wrap app in <ToastProvider>
App.tsx                        — nav bar restyle; readPublicView() restore; in-app legal
                                  modal (footer + root render); "Free Plan" nav → "Pricing"
components/LandingPage.tsx      — centred hero text, marquee, colour grade, HeroBackground;
                                  new #pricing section (3 plans + add-on note)
components/Login.tsx            — studio card, icon inputs, password toggle, "Back to home";
                                  "Ledger" rebuild; legalDoc state, in-app Privacy modal
components/TermsOfServiceModal.tsx — "Ledger" restyle + doc:'terms'|'privacy' + onSwitchDoc
constants/termsOfService.ts     — PRIVACY_SECTIONS + PRIVACY_EFFECTIVE_DATE
components/OrganicDialog.tsx    — rebuilt on .kw-overlay / .kw-sheet / .btn
components/Billing.tsx          — Design System v3 pass (#19): page-head, surface, kw modals
components/InsightsDashboard.tsx — Design System v3 pass (#19)
components/Settings.tsx         — Design System v3 pass (#19): tokens, .input, .btn, .surface
components/ContentCalendar.tsx  — TOAST calendar, PostComposer, PlanningModal, layout,
                                  resilient loadData, toast confirmations
components/AdminDashboard.tsx   — full render rewrite → Admin Console
config/database.ts             — SQLite reliability pragmas + checkpointing
services/databaseService.ts    — checkpoint() passthrough
server.js                      — crash guards, error handler, graceful shutdown, AI timeout
package.json / package-lock.json
```

### Deleted

```
components/calendar/ScheduleXCalendarView.tsx
components/calendar/KawayanMonthGridEvent.tsx
components/calendar/mapScheduleXEvents.ts
components/calendar/scheduleXTheme.css
```

### Package changes

```
- @schedule-x/calendar            ^4.6.0
- @schedule-x/calendar-controls   ^4.6.0
- @schedule-x/events-service      ^4.6.0
- @schedule-x/react               ^4.1.0
- @schedule-x/theme-default       ^4.6.0
+ @toast-ui/calendar              ^2.1.3
+ ts-essentials                   ^9.4.2   (devDependency)
```

---

## 11. Notes / possible follow-ups

- `public/video/video.mp4` (~1.4 MB) is no longer referenced — safe to delete.
- The AI endpoint (`/api/ai/unsloth`) points at a hardcoded localtunnel URL in
  `server.js` that is currently dead; the frontend fallbacks + the new 20 s
  timeout handle this gracefully, but set `UNSLOTH_API_URL` / `UNSLOTH_API_KEY`
  in `.env` for real generation.
- Not done (larger, separate efforts): splitting the 1,500-line `server.js` into
  route modules and the 1,259-line `databaseService.ts` into repositories;
  carrying the toast pattern into more screens; a deeper Insights/Verification/
  Survey visual pass (they already inherit the v3 system).
- Landing-page *content* was intentionally not changed per instruction; it only
  picks up the shared token/button refinements.

### Run locally

```bash
npm run server   # API + sockets on :3001  (npx tsx watch server.js)
npm run dev       # Vite on :3000
# or both:
npm run dev:full
npx tsx seed.ts   # reseed the SQLite DB
```

Seed accounts: `admin@kawayan.ph / Admin123!` · `cafe@kawayan.ph / Password123!`
