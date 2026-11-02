# Kawayan redesign notes (branch `redesign1`)

Goal: make the app look like `docs/redesign/mockup.html` without changing what it does.
Nothing in `server.js`, `server/`, `scripts/`, `src/services/`, API calls, Supabase or auth/payment
logic is touched. All work is CSS, class names and markup around existing logic.

## Approach

1. **Tokens first.** `src/styles/theme.css` keeps its variable *names* (`--bg`, `--card`, `--fg`,
   `--fg-muted`, `--primary`, `--primary-accent`, `--bg-alt`, `--border-strong`, the emerald/slate
   palette ramps, shadcn `--color-*` aliases…) but every value is replaced with the mockup's
   neutral zinc + one green. Because ~400 places already read these variables, most screens
   change colour without touching their markup.
   - `--primary` (links, focus, active states) becomes the green *ink* (`--green-ink`), which reads
     as text, not as a fill.
   - `--primary-accent` (main action buttons) becomes the solid green.
   - The emerald ramp is re-pointed at the new green, the slate ramp at zinc greys.
   - Light/dark keep using the existing `.dark` class on `<html>` set by App.tsx.
2. **Fonts.** Geist + Geist Mono + Fraunces 900 via `@fontsource` (self-hosted); Plus Jakarta Sans
   and the Google Fonts links in `index.html` are removed.
3. **Shared primitives** (`.btn`, `.input`, `.badge`, `.card`, `ui/*`) are reshaped to the mockup's
   sizes (8px buttons, 12px cards, pill badges, 1px borders, very soft shadow).
4. **Screens**, in the order given in the brief, then a final pass for dark mode / 390px / reduced
   motion.

## Screen-by-screen plan

| Mockup screen | Files | Plan |
|---|---|---|
| Landing `#v-home` | `LandingPage.tsx`, `landing/*`, `landing.css` | Railed 1152px column with `+` marks, bands, dashed spacers, pill header, dot grid hero. Replace hero roller with the mono business-type marquee band. Keep WhyKawayan animation untouched, restyle surroundings. |
| Log in / Sign up / Reset | `Login.tsx`, `auth/*` | Split layout: form on the left, muted dotted image panel on the right; stepper bars; meter bars. Staff login uses same shell. |
| Brand DNA `#v-brand` | `BrandSurvey.tsx`, `settings/VoicePreview.tsx`, `onboarding.css` | Settings rows (label column + controls), voice radio cards + preview card. |
| Verification `#v-verify` | `VerificationStatus.tsx` | Timeline + action cards. |
| App shell | `layout/DashboardLayout.tsx`, `NotificationCenter.tsx`, `AccountMenu.tsx`, `tour/*`, `AccessibilityWidget.tsx`, `appShell.css` | Sidebar-inset layout: grey sidebar (business, menu, quota card, account button) + rounded bordered page panel with top bar. Phones: slide-in drawer. |
| Calendar | `ContentCalendar.tsx`, `calendar/*`, `kawayanCalendar.css` | Card with toolbar, month grid with mono day numbers and green "today", post chips; wide screens show selected post in a right panel. |
| Post studio | `calendar/PostComposer.tsx`, `FormatPicker.tsx` | Cards: image, caption, preview phone. |
| Month planner | `calendar/PlanningModal.tsx`, `PostCountPicker.tsx` | Form card + generated grid; seg-pick buttons. |
| Insights | `InsightsDashboard.tsx`, `insights.css` | Stat cards, recharts with token colours. |
| Billing | `Billing.tsx` | Plan cards, dark wallet card, table. |
| Settings | `Settings.tsx`, `SettingsAppearance.tsx`, `SocialAccounts.tsx`, `settings/SettingsParts.tsx` | Settings blocks with row layout. |
| Help desk | `HelpPanel.tsx`, `support/ChatThread.tsx` | Thread bubbles (me = green-soft), assistant box. |
| Admin | `AdminDashboard.tsx`, `admin/*`, `adminConsole.css` | Near-black sidebar, stats, tables. |
| Support inbox | `SupportDashboard.tsx`, `support/*` | Three-pane inbox, call window. |

## Checklist (every screen, tab, dialog and panel found)

Legend: `[ ]` todo, `[x]` restyled.

### Foundations
- [x] Tokens (light + dark) in `theme.css`, mapped onto app + shadcn variables
- [x] Fonts: Geist, Geist Mono, Fraunces 900 (self-hosted), Plus Jakarta Sans removed
- [x] `.btn`, `.input`, `.badge`, `.card`, `.surface`, `.page-head`, `.eyebrow`, scrollbars, focus ring
- [x] `ui/button.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/popover.tsx`, `ui/dropdown-menu.tsx`, `ui/tabs.tsx`, `ui/switch.tsx`, `ui/tooltip.tsx`
- [x] `ui/Toast.tsx`
- [x] `ui/DynamicIslandAlert.tsx`
- [x] `ui/Stepper.tsx` + `stepper.css`
- [x] `OrganicDialog.tsx` (alert / confirm / prompt)
- [x] `KawayanLogo.tsx`
- [x] `AppHydrationLoader.tsx`
- [x] `styles/accessibility.css` (high-contrast etc. still work with new tokens)

### App shell
- [x] Sidebar (desktop) with business header, menu groups, quota card, account button
- [x] Top bar (sidebar toggle, breadcrumb, search, bell, theme state)
- [x] Phone drawer (replaces bottom tab bar visually; same items)
- [x] Expired-channel warning banner
- [x] Post search results popover
- [x] Notification center
- [x] Account menu
- [x] Spotlight tour (`tour/*`)
- [x] Accessibility widget (floating, public pages) + Settings › Appearance version
- [x] Support-role "calendar is for SME accounts" placeholder (App.tsx)
- [x] Generic top nav for non-dashboard signed-in views (App.tsx)

### Owner screens
- [x] Calendar: header, stats/up-next, toolbar, Segmented view switch
- [x] Calendar: Month grid (`MonthGrid`)
- [x] Calendar: Timeline (`ChannelTimelineTrack`, `TimelinePostCard`)
- [x] Calendar: Agenda / list (`AgendaView`)
- [x] Calendar: `UpNext`
- [x] Calendar: post details (right panel on wide screens, `PostDetailSheet` on small)
- [x] Calendar: `PhonePreview`
- [x] Calendar: empty / loading / error states, delete & reschedule confirms
- [x] Post studio (`PostComposer`, `FormatPicker`)
- [x] Month planner (`PlanningModal`, `PostCountPicker`)
- [x] Insights (`InsightsDashboard`, `insights.css`, compare tray)
- [x] Billing (plans, wallet, top-up, history, payment dialogs)
- [x] Settings › Business
- [x] Settings › Voice & audience
- [x] Settings › Login & security
- [x] Settings › Appearance (`SettingsAppearance`)
- [x] Settings save bar
- [x] Social accounts (`SocialAccounts`)
- [x] Help panel incl. Ask the assistant box (`HelpPanel`)
- [x] Support chat thread (`support/ChatThread`)

### Public / onboarding
- [x] Landing: header (`LandingNav`)
- [x] Landing: hero (`HeroShowcase`) — roller removed, auto-cycling shops kept
- [x] Landing: business-type strip (marquee)
- [x] Landing: Features
- [x] Landing: How it works
- [x] Landing: Why Kawayan (animation unchanged)
- [x] Landing: pricing / CTA / footer (whatever exists in `LandingPage.tsx`)
- [x] Log in (`Login`, `AuthShell`, `AuthField`)
- [x] Sign up (`SignupStory`, `StepProgress`, `PasswordMeter`)
- [x] Staff login (ADMIN_LOGIN)
- [x] Reset password (`ResetPassword`)
- [x] Brand DNA survey (`BrandSurvey`, `VoicePreview`)
- [x] Verification status (`VerificationStatus`) — pending / rejected / none / upload
- [x] Legal pages (`LegalPage` privacy + terms)

### Staff
- [x] Admin console shell (near-black sidebar)
- [x] Admin › Overview
- [x] Admin › Users
- [x] Admin › Verification (`admin/AdminVerification`)
- [x] Admin › Billing (payments to verify)
- [x] Admin › Help desk
- [x] Admin › Audit logs
- [x] Admin › Settings ("Allow registrations")
- [x] Support inbox (`SupportDashboard`, `support.css`)
- [x] Call window (`support/CallWindow`, `callWindow.css`)

### Final pass
- [x] Dark mode on every screen
- [x] 390px: no sideways scroll, drawer, stacked grids, tables scroll in their box
- [x] Reduced motion: no movement, no marquee
- [x] Remove CSS no longer imported

## Shown in the mockup but not in the app (ideas only, not built)

- **System theme mode.** The brief says "keep light, dark and system", but the app today only has
  Light and Dark (`readThemeFromSession` returns a boolean; App.tsx toggles `.dark`). No system mode
  was added, since that would be a new setting.
- **Integrations hub section** on the landing page (Facebook / Instagram / GCash / Maya diagram).
- **Gallery** of AI images on the landing page (the mockup's `img/*.jpg` samples are not app content).
- **Contact form** section on the landing page. (Testimonials and FAQ already existed in the app,
  so they were restyled into the mockup's wall-of-quotes and two-column FAQ.)
- **Footer sitemap** with big outlined "Kawayan" wordmark.
- **Announcement pill** ("New · Plan a whole month in one click") linking to the planner.
- Calendar: **stat cards row** (posts this month, drafts to approve, needs attention, avg reach
  score) and **channel filter select** — only shown if the data/control already exists.
- Calendar list view **"Reach" column** and **"Version 1 of 3"** caption counter where not already present.
- Post studio **best-time slot buttons** ("Lunch break / After work / Prime time") and **quick tweak chips**, unless already present.
- Topbar **global search for every page** (the app searches posts only, owner role only).
- Admin overview **system status list** and Support inbox **customer details rail**, where the data isn't loaded today.
- Verification review **document viewer with "SAMPLE" watermark**.

## Risks

- **Phone navigation**: the brief asks for a slide-in drawer instead of the current bottom tab bar.
  The same nav items and handlers are used; `body.has-tabbar` offsets for toasts/save bars are
  removed with the tab bar. Check that toasts, Insights compare tray and Settings save bar sit
  correctly on phones.
- **Calendar side panel**: wide screens render the selected post's details in a right column
  instead of the sheet. The same `PostDetailSheet` content and actions are reused; on small
  screens it remains a sheet.
- **Global token remap**: some components used palette names (e.g. `text-emerald-500`) for meaning.
  The emerald ramp now maps to the new green, so their meaning is kept, but contrast was rechecked.
- **Fonts** are now bundled (`@fontsource`), adding ~100–200 KB of woff2 to the build.
- `npm run dev` cannot fully run without `.env` (Supabase keys), so verification relies on
  `typecheck`, `build` and static-page screenshots where possible.

## Progress log

(One entry per step: what changed · what to check · what's left.)

**Step 1 — tokens, fonts, shared UI.** New zinc + green tokens in `theme.css` (old variable names
kept and re-pointed), Geist/Geist Mono/Fraunces via @fontsource, Google Fonts links removed,
new bamboo logo, reshaped `.btn/.input/.badge/.card`, ui/* (button, switch, tabs, dialog, sheet,
popover, dropdown, toast pill, stepper), OrganicDialog with muted footer, new hydration loader.
Check: any screen in light/dark — colours should already be neutral with green only on main buttons.
Left: per-screen layout work (steps 2–9).

**Step 2 — app shell.** `DashboardLayout` is now the mockup's sidebar-inset layout: grey sidebar
(business, Workspace/Account groups, Ask AI/Help with ⌘K, quota + engine card, account button that
opens upward), page in a rounded bordered panel with a top bar (sidebar toggle, breadcrumb, post
search, Create post, bell, theme toggle). Phones: the bottom tab bar is replaced by a slide-in
drawer (same items, focus-trapped, Esc/scrim to close). Notification center, account menu, tour
and accessibility widget restyled. The theme toggle calls the same `updateTheme` as Settings.
Check: collapse/expand sidebar, drawer on a phone, ⌘K help, bell, account menu, Reconnect banner.
Left: tour cutout no longer animates its position (only opacity/transform are animated now).

**Step 3 — calendar.** Calendar card with mockup toolbar (outline month buttons, tabs-style view
switch, green Plan month), month grid with mono day numbers, green "today", hatched out-of-month
cells and `.pchip`-style post chips (posted = green tint, draft = dashed, failed = red border, time
in mono; status kept as screen-reader text and in the legend). Timeline pills/lanes, list view,
Up next pills, empty-month card and status badges restyled. At ≥1280px the selected post opens in a
right-side panel (same content and actions as the sheet; Esc or × closes; the "Not sent yet" tray
hides while it is open to give the grid room). Below 1280px it is still the sheet.
Check: open a post on a wide and a narrow window, drag a draft to another day, Reschedule, Retry.
Left: none for the calendar itself.

**Step 4 — post studio and month planner.** Both dialogs use the new tokens with a plain 45% scrim
(no blur), 12px panel radius, neutral step numbers (active = black/white, done = green), chip-style
format and strategy pickers (selected = green-soft), green progress bars, links as underlined text.
The studio's step sections now fade/slide in instead of animating height.
Check: Create post → Draft with AI → tweak chips → schedule; Plan month → plan ideas → create posts.
Left: nothing; mockup-only extras (best-time slot buttons) noted as ideas.

**Step 5 — insights, billing, settings, social, help.** Charts and sparklines use the green line +
green-soft fill with a dashed grey comparison line; deltas in mono. Billing wallet is the mockup's
inverted (black/white) card; amounts and dates in mono. Settings gets a left section menu on wide
screens (tabs on small), tighter settings rows, new Light/Dark preview swatches, a squarer save bar.
Social: green Connect/Reconnect buttons and a "Connected" badge. Help panel/chat: neutral icon tiles,
my messages on green-soft, internal notes on dashed amber, mono timestamps.
Check: Settings → each section, save bar, Appearance theme switch, Replay tour; Billing top-up and
cancel pending; Social connect; Help → message, call, Assistant.
Left: nothing for these screens.

**Step 6 — auth, onboarding, legal.** Log in / sign up / staff login now use the mockup's split
layout: form on the left (left-aligned 30px title, 40px fields, 8px buttons), a muted dotted panel on
the right with three existing AI sample images (sign-up shows its "what happens next" story card
there instead). Reset password is a centred card on a dotted page. Step bar, strength meter, permit
upload, terms checkbox and errors restyled. Brand DNA and Verification lose the coloured orbs and
the dark-green preview card: neutral cards, mono labels, green only for done steps/selected voice.
Legal pages: tabs-style Terms/Privacy switch, green rail on the active section.
Check: sign up all 3 steps (permit upload), staff login at /admin-portal, reset link, Brand DNA all
4 steps, verification pending / rejected (re-upload) / approved, /privacy and /terms.
Left: the mockup's testimonial card beside the login form is not added (it is a sample quote).

**Step 7 — landing page.** Rebuilt on the mockup's ruled page: a centred 1152px column with side
rails, full-width bands with "+" marks, dashed spacer rows, a floating pill header (links now include
FAQ), a dot grid behind a centred hero, and a framed "screenshot" of the selected shop (week lane +
phone preview) that still changes by itself every ~4.2 s. The right-side business-type roller is
gone; the band under the hero is the mockup's strip ("Made for every Filipino MSME", all 16 types in
mono uppercase with green dots, one slow seamless row with faded edges, pauses on hover, a static
wrapped list with reduced motion, plus a screen-reader list). Stats, "Trusted by", How it works,
Features, testimonials, pricing (cells, Pro highlighted green-soft), trust strip, FAQ (title left /
questions right), CTA with the mockup's strip, and the footer with the outlined "Kawayan" word.
Why Kawayan: same markup and animation; now on the near-black band with #111113 cards.
Removed: the pinned/parallax hero scroll effect and mouse parallax (decorative motion only).
Check: header links/active section, phone menu, theme toggle, hero CTAs, FAQ open/close, pricing
buttons → sign up, footer Privacy/Terms/staff lock, reduced motion.
Left: unused old landing CSS is cleaned up in step 9.

**Step 8 — staff.** The admin console uses the same sidebar-inset frame as the owner app with the
mockup's near-black sidebar (grouped menu with counts, health card, account button at the bottom
opening upward) and a top bar (breadcrumb, search, theme toggle). The support role's shell gets the
same near-black sidebar. KPI tiles follow the mockup's stat cards (revenue tile inverted), tables use
sentence-case headers, mono numbers/money, muted row hover; segments look like the mockup tabs.
Verification queue: green rail on the selected submission, status tags as badges. Support inbox:
green only for "waiting on a call" and resolve. Call window: neutral near-black, mono timer, opens
with a short scale-in instead of animating width/height.
Check: every admin tab (Users edit/delete dialogs, Billing approve, Help desk, Audit logs filter,
Settings › Allow registrations / Maintenance), verification approve/reject, support inbox reply,
internal note, call join/leave/expand/dock.
Left: on phones the admin console keeps its horizontal tab row (no drawer) — it already works and
needs no new state.

**Step 9 — final pass.** Swept every component for old palette utilities (emerald/sage/slate/amber/red
hard-codes, `font-bold`, brand fills) and re-pointed them at the tokens; folded the Why-band
overrides into the base rules; removed CSS nothing uses any more (old hero roller, glow border,
section blobs, phone tab bar, sidebar `.adm-nav` rules, unused scroll/pulse keyframes,
`.dot-pattern-dark`); removed the last width/height transitions. Checked: dark mode on every screen,
390px on landing, auth, Brand DNA, verification, legal, calendar, insights, billing, settings,
social and support (page `scrollWidth` = 390 everywhere), reduced motion (static business-type
list, no hero cycling), and the in-app "Reduce motion" setting also stops the strip.
Contrast (WCAG, 4.5:1 minimum) for every text/background token pair, both themes:
fg/bg 19.0 · muted-fg/bg 5.1 (light) 7.8 (dark) · muted-fg/muted 4.8 / 6.7 · white on green 5.4 ·
green-fg on dark green 7.7 · green-ink on green-soft 7.1 / 10.1 · amber on amber-soft 5.8 / 9.0 ·
danger on card 5.9 / 6.8 · staff sidebar #a1a1aa on #0a0a0a 7.7. All pass.

## Files changed (whole redesign)

`index.html`, `package.json`, `package-lock.json` (adds @fontsource/geist, geist-mono, fraunces),
`REDESIGN_NOTES.md`, `src/index.tsx`, `src/App.tsx`, `src/styles/theme.css`,
`src/styles/accessibility.css`, `src/components/`: AccessibilityWidget, AccountMenu, AdminDashboard,
AppHydrationLoader, Billing, ContentCalendar, HelpPanel, InsightsDashboard, KawayanLogo, LandingPage,
LegalPage, OrganicDialog, Settings, SettingsAppearance, SocialAccounts, SupportDashboard,
VerificationStatus, appShell.css, insights.css, onboarding.css; `admin/` AdminVerification,
adminConsole.css; `auth/` AuthShell, ResetPassword, authShell.css; `calendar/` ChannelTimelineTrack,
FormatPicker, MonthGrid, PhonePreview, PlanningModal, PostComposer, PostCountPicker, PostDetailSheet,
Segmented, TimelinePostCard, kawayanCalendar.css; `landing/` HeroShowcase, LandingNav, landing.css;
`layout/` DashboardLayout, NotificationCenter; `settings/` SettingsParts, VoicePreview; `support/`
callWindow.css, support.css; `tour/tour.css`; `ui/` DynamicIslandAlert, button, dialog,
dropdown-menu, popover, sheet, stepper.css, switch, tabs.

## Test by hand (needs real keys / a backend)

1. Sign up: all three steps incl. permit upload and terms → verification pending screen.
2. Admin approval: staff login at /admin-portal → Verification → approve → owner screen flips to approved.
3. Brand DNA: all four steps → lands on the calendar and the tour starts.
4. Generate a month: Plan month → plan ideas → create posts; check the planner progress bar.
5. Approve a post: open a draft (side panel on a wide window, sheet on a narrow one) → Edit →
   schedule; drag a draft to another day; Reschedule from the panel.
6. Publish: Post now / Schedule to Facebook and Instagram; check the notification center and the
   "Posted" chip/badge; Retry a failed post.
7. Payment: Billing → top up via PayMongo (test card) and Upgrade to Pro; cancel a pending payment.
8. Support chat and call: Help → message, voice and video call from the owner; reply, internal
   note, join/expand/dock the call from the support inbox.
9. Theme: top-bar toggle, Settings › Appearance, admin Settings › Appearance; accessibility widget
   (public pages) and Settings › Accessibility (text size, high contrast, reduce motion).
10. Phone: open/close the drawer, ⌘K help on desktop, landing phone menu.

---

# Phase 2 gap list

Every element the mockup shows, per screen. Tags: **have** = already in the app (restyle only),
**FE** = to add, frontend only, **API** = needs a new (additive) endpoint, **MIG** = needs a
migration in `scripts/migrations/` (UI hides it until the column exists).
`[x]` = done in Phase 2.

Note: the brief points to PH holidays in `src/services/aiService.ts`, but no holiday data exists in
the app (only a prompt rule). Phase 2 adds `src/utils/phCalendar.ts` (fixed-date PH regular and
special holidays, movable ones like Holy Week and National Heroes Day, and paydays on the 15th and
the last day), used by the calendar tags and the Month planner's "Dates Kawayan found".

## A. App shell
- [x] Sidebar header: business avatar (initials), name, "<Plan> plan" — **FE**; "· city" — **MIG** (`brand_profiles.city`, hidden until it exists)
- [x] Group "Plan": Calendar, Month planner (new page), Post studio (new page) + drafts badge, Insights — **FE**
- [x] Group "Account": Settings + red channel-problem badge, Plan and billing, Help desk (new page) — **FE**
- [x] Social accounts stay reachable (Settings › Channels links to it; `/social` still works) — **have**
- [x] Quota card "<Month> posts X / limit", bar, "Resets <1st>." — **FE**. It says "Drafts count too." instead of the mockup's "Drafts don't count": the app (and the server's TIER_LIMIT check) counts every saved post, drafts included, and that rule was not changed.
- [x] Account button (avatar, name, email) → menu: Settings, Plan and billing, Help desk, Take the tour, Appearance Light/Dark/System, Log out — **FE** (System = follows the OS; saved on this device, Light/Dark still saved to the account)
- [x] Top bar: sidebar toggle, breadcrumb "Business › Page", theme toggle — **have**
- [x] Search box with ⌘K focusing it, searches loaded posts by title/caption, opens the post — **FE** (⌘K currently opens Help; it moves to search, Help keeps its sidebar entry and the "?" shortcut)
- [x] Bell with unread dot; popover "Needs you / All", one action per item (Fix now, Review, Open ticket), "Mark all as read" — **FE**
- [x] Phones: sidebar as a drawer — **have**

## B. Calendar
- [x] Header "<Month YYYY>", drafts line, "New post", green "Plan <next month>" → Month planner page — **FE**
- [x] 4 stat cards: posts X/limit + left on plan; drafts to approve + next due; needs attention (held/failed) + reason; avg reach score + change vs last month (hidden when last month has none) — **FE** (last month's posts fetched with the existing month query)
- [x] Amber banner for held/failed posts: post name, date, Reconnect → Settings › Channels — **FE**
- [x] Toolbar: month title, prev / Today / next, channel filter, Month / Timeline / List — **have**
- [x] Month view: weekday header, hatched out-of-month, green today, chip styles, drag-and-drop — **have**
- [x] PH holiday and payday tags in day cells — **FE** (new `phCalendar.ts`)
- [x] Selected chip outline — **FE**
- [x] Held = scheduled post whose page lost access → red-border chip — **FE**
- [x] Timeline view by channel — **have** (lanes per channel, days across)
- [x] List view as a table: post, when, channels, status, reach — **FE** (replaces the agenda list layout; same data and click-through)
- [x] Legend — **have** (mono tag sample added) 
- [x] Detail panel: image, title, date/time, status, held alert, channel badges, caption + "Version X of 3", reach bar + reason — **FE**
- [x] Panel actions by status, wired to existing handlers: draft Approve and schedule / Edit / Regenerate; held Reconnect / Move date / Retry; posted View on Facebook / Insights / Duplicate; scheduled Edit post / Move date / Unschedule — **FE** + Duplicate (new handler through the existing save-post call) + Unschedule — **API** (`POST /api/social/unschedule`)
- [x] UpNext, tour targets, empty-month pitch, idea editing — **have**

## C. Month planner page
- [x] New sidebar page (`/planner`) using the calendar's planning state and the same generate calls; "Plan month" and the empty-month pitch open it — **FE**
- [x] "Your month": month select, 8 / 12 / 16 cards limited by plan and open days, Formats chips, "Dates Kawayan found" checkboxes, notes, "Generate N posts", hint — **FE**
- [x] Formats, dates and notes passed to the AI as new optional arguments to `generateContentPlan` (the `/api/ai/text` request is unchanged) — **FE**
- [x] "Generating": "X of N ready" + bar, cards appear one by one, shimmer skeletons, Cancel / Add to calendar — **FE** (Cancel stops after the post being written; posts already written stay as drafts)
- [x] Existing planning modal behaviour (ideas list, edit/delete idea, batch create) — **have** (kept on the page)

## D. Insights
- [x] Header: date range select (Last 7 days / Last 30 days / This year) + Export CSV (existing downloads) — **FE** (90 days stays as an option)
- [x] KPI cards with sparkline + change: Followers, Reach, Interactions, Avg reach score — **FE** (Avg reach score from real post scores; the engagement-rate card moves into the table/compare)
- [x] "Daily reach" chart: green line + soft area, dashed previous, axis labels, dot on last point, legend — **FE** (recharts; metric switch kept)
- [x] "By platform": horizontal bars with totals — **FE**
- [x] "Best time to post": one sentence from the posts' day part with the highest average reach — **FE** (only when enough posts have a known time; otherwise hidden)
- [x] Post performance table: thumbnail + title, posted, reach, interactions, score badge (green 75+), checkboxes, "Pick 2 to compare", Compare → existing compare view — **FE**
- [x] "Demo data, generated for each account" note — **have**

## E. Post studio page
- [x] New sidebar page (`/studio`) with the composer's logic; no post chosen → drafts list to pick from + New post — **FE**
- [x] Header: title, status line, Save draft, green "Approve and schedule" — **FE**
- [x] Image card: image, "Image made by Kawayan AI" (or "Your photo"), New image, Upload my own photo — **FE**
- [x] Caption card: version picker 1–3 (used-up disabled), textarea + counter, quick tweaks (Shorter, More Taglish, More playful, More polished, Fresh hashtags, Add a call to action), hashtags, reach score, date + time, slots (Lunch break / After work / Prime time), "Post to" switches with Reconnect badge — **FE**
- [x] Phone preview with Facebook / Instagram tabs — **have** (PhonePreview)
- [x] Composer modal everywhere it opens today — **have**

## F1. Plan and billing
- [x] Current plan card: price, Active badge, usage bar, reset line, "Buy 1 extra post", "Cancel at the end of the month" — **FE** (cancel stays "Switch to Free", which takes effect right away: the backend has no end-of-month cancel; that would need a `cancel_at` column plus a monthly job — not built) (extra post opens the studio's paid-extra flow; the wallet is charged only when the post is written, as today)
- [x] Dark wallet card — **have**; "Add funds" control — **have**
- [x] 3-column plan comparison (Free / Pro / Enterprise) — **FE** (Enterprise "Talk to us" opens the Help desk once it exists)
- [x] Payment history table: date, description, method, amount, status badge, receipt / Retry — **FE** (method = "Wallet" / "PayMongo" from the transaction type; receipt = the PayMongo reference; Retry re-opens checkout for a failed top-up)

## F2. Settings
- [x] Left section menu: Business, Voice & audience, Channels, Appearance, Login & security, Payments & plans, Accessibility — **FE**
- [x] Label-left / control-right rows, save bar — **have**
- [x] Channels section (Connected / Reconnect states, Connect) inside Settings — **FE** (reuses SocialAccounts)
- [x] Appearance theme cards — **have**; System option — **FE**
- [x] Payments & plans section (summary + link to billing) — **FE**
- [x] Export my data (JSON download of profile, posts, plans, payments, tickets) — **FE**
- [x] Delete account — **API** (`DELETE /api/auth/me`, confirm by typing the email)

## F3. Help desk (owner)
- [x] Help desk page (`/help`): ticket list with status badges + search, conversation thread (mine tinted green), reply box with attachment, "Ask the assistant" card, New ticket — **FE** (reuses the Help panel's ticket/chat logic; the slide-over panel stays)

## F4. Staff — Admin overview
- [x] 4 stat cards: Businesses, Permits to review, Payments to verify, Open tickets — **FE**
- [x] "Sign-ups, last 14 days" bar chart — **FE** (from the loaded users list)
- [x] System status list (API, Database, AI, Zernio, PayMongo) + "Allow registrations" switch — **API** (`GET /api/admin/system-status`: configured/ok flags only, never key values). The switch mirrors the existing Settings switch (local state today, see risks)
- [x] Recent activity from the audit log — **have**

## F5. Staff — Verification
- [x] Pending / Approved / Sent back tabs — **FE** (existing filters renamed)
- [x] 3 panes: queue, document viewer, right rail (business info, checks list, send-back reason + note, Approve / Send back) — **FE** (checks are a reviewer aid, not saved; reason + note become the existing rejection reason)

## F6. Staff — Support inbox
- [x] Mine / Unassigned / All; Open / Waiting / Snoozed / Resolved; priority, number, business, "Reply due in…" — **have** (priority, SLA, snooze and labels already exist on tickets; no migration needed)
- [x] Thread with Claim / Snooze / Resolve, internal notes (amber), Reply / Internal note tabs, saved replies, R / E hints — **have**
- [x] Right rail: business, ticket details, other tickets — **FE** (check and fill what's missing)

## F7. Auth, Brand DNA, Verification, Landing leftovers
- [x] Login: "Forgot password?" beside the password label, "Kept safe" divider + trust list, "Staff sign in" link — **FE**
- [x] Sign up: "Log in instead" in the top bar, stepper "1 · Account / 2 · Brand DNA / 3 · Verification" — **FE** (keeps the app's own fields)
- [x] Brand DNA: stepper top bar with Help desk link — **FE**; "Where are you?" — **MIG** (same `city` column); Language tabs — **MIG** (`brand_profiles.language`) — hidden until the columns exist
- [x] Verification: stepper top bar, "While you wait" cards (Brand DNA, opens after approval, Help desk) — **FE**
- [x] Landing — **have** (Phase 1); Integrations / Gallery / Contact stay as ideas (no app content)

## Migrations for me to run
1. `scripts/migrations/2026-11-02-brand-city-language.sql` — adds `brand_profiles.city` (text) and
   `brand_profiles.language` (text, Taglish / English / Filipino). Until it runs, Settings hides
   "Where are you?" and "Language" and nothing is sent for them; after it runs both rows appear,
   save with the brand profile, and captions use the language and the city as local context.

### Phase 2 progress log

**A — shell.** Sidebar: business initials avatar, name, "<plan> plan"; groups Plan (Calendar,
Insights) and Account (Settings with a red badge for expired channels, Channels, Plan and billing,
Help desk); quota card "<Month> posts X / limit" + bar + reset date + engine line; account button
with name and email. Account menu: Switch account, Settings, Plan and billing, Help desk, Take the
tour, Appearance Light / Dark / System, Log out. System follows the device (saved on the device;
Light/Dark still saved to the account). ⌘K / Ctrl+K now focuses the post search (as the mockup
shows); Help moved to ⌘/ / Ctrl+/ and stays one click away in the sidebar. Notifications: "Needs
you" (expired pages with held posts → Fix now, failed posts → Retry, drafts → Review, support
replies → Open ticket) and "All" (plus posted and payment history), unread dot, Mark all as read.
Month planner, Post studio and Help desk nav entries arrive with their pages (C, E, F3).

**B — calendar.** Header with "<Month YYYY>", the drafts line, New post and a green "Plan <next
month>"; 4 stat cards (posts X / limit + left on plan, drafts to approve + next due, needs attention
+ reason, avg reach score + change vs last month, hidden when last month has no scored posts);
amber banner for held / failed posts or a page that lost access (Reconnect); PH holiday and payday
tags (new `src/utils/phCalendar.ts`); held chips (scheduled to a page that lost access) in red;
selected chip outline; List view is now the mockup's table (post, when, channels, status, reach).
Detail panel: image, title, date/time, status (or Held), held/failed alert, channel badges, caption
with "Version X of 3", reach bar + reason, and actions by status — draft: Approve and schedule
(schedules to every connected page at the studio's suggested time, after a confirm) / Edit /
Regenerate (+ Move date); held: Reconnect / Unschedule / Edit; failed: Retry / Move date / Edit;
posted: View on Facebook / Insights / Duplicate; scheduled: Edit post / Move date / Unschedule.
New: Duplicate (draft copy on the next free day via the existing save-post call), Unschedule
(new additive endpoint `POST /api/social/unschedule`). The toolbar "Plan month" stays (secondary)
for the month on screen; the shell's lost-access banner is hidden on the calendar, which shows its own.

**C — Month planner page.** New `/planner` page (sidebar "Month planner"). It is the same
ContentCalendar (shared state, same AI calls) in a different layout: "Your month" card (month
select for this month and the next two, 8 / 12 / 16 cards limited by the plan and open days, plus
"All that's left" when fewer fit; Formats chips Single photo / Text post / Video — the app's real
formats; "Dates Kawayan found" checkboxes from `phCalendar.ts`; "Anything special this month?";
the existing focus presets; green "Generate N posts"; the failed-calls hint) and a "Generating"
card ("X of N ready" + bar, drafts appear one by one as they're saved, pulsing skeletons for the
rest, Cancel stops after the post being written, "Add to calendar" goes back to the calendar).
The existing ideas list (edit title, remove, write posts for them) stays on the page.
`generateContentPlan` takes a new optional `extras` argument (formats, dates, notes) folded into the
prompt; the `/api/ai/text` request is unchanged, so older callers work as before. "Plan <next
month>", the toolbar "Plan month", the empty-month pitch and Up next now open this page; the
planner dialog component is still there (used if the page isn't wired).

**D — Insights.** Date range select (Last 7 / 30 / 90 days, This year) replaces the 7D/30D/90D
buttons (platform filter kept); "Export CSV" is the existing download menu (posts CSV, growth CSV,
full JSON report). KPI cards: Followers, Reach, Interactions (demo history, as before) and a new
Avg reach score from the owner's real post scores in the period vs the period before (hidden change
when the earlier period has none); every card has a green sparkline with a soft fill. The chart is
"Daily reach" by default (metric switch kept), with a dot on the last point. "By platform": reach
bars with totals, then the existing followers/reach lines. "Best time to post": the day part with
the highest average reach among posts whose publish/schedule time is known on this device; hidden
behind a plain message until 3+ such posts exist. Table: Post, Posted, Reach, Interactions, Link
clicks (wide screens), Eng. rate, Score badge (green at 75+), checkboxes, "Pick 2 to compare" and a
Compare button in the card header (the compare tray stays). The engagement-rate KPI card moved out
of the KPI row; the rate stays in the table, compare view and exports.

**E — Post studio page.** New `/studio` page (sidebar "Post studio" with a badge for upcoming
drafts). With no post open it lists Drafts to approve, Didn't go out and Scheduled (all months),
plus New post. With a post open it is the mockup's three columns, built from the same
PostComposer logic (its pieces are now shared by the dialog and the page): image card (New image,
Upload my own photo, Describe the image), caption card (Version 1–3 picker: earlier versions swap
in, the next slot writes a new version while rewrites are left, the rest are disabled; caption +
counter; the six quick tweaks; ask box; hashtags; reach score; When date + time + Lunch break /
After work / Prime time slots and "Post right away instead"; Post to switches with a Reconnect
badge for pages that lost access) and the phone preview with Facebook / Instagram tabs. Header:
title, status line, Save draft, green "Approve and schedule" (or "Post now"). Changing the date
moves the draft with the calendar's own move (confirm, one post per day). The dialog still opens
from the calendar, search, notifications and "Create post" exactly as before.

**F1 — Plan and billing.** Mockup layout: current-plan card (price, Active, this month's posts
used of the limit with a bar, reset date, "Buy 1 extra post · ₱150" → opens the Post studio's new
post where the paid extra flow already runs, Switch to Free / Upgrade), the dark wallet card with
Add funds, a Free / Pro / Enterprise comparison and a payment-history table (date, description,
method from the reference — PayMongo / Xendit / Wallet, amount, status badge, Copy ref / Continue /
Cancel / Retry). Test-mode and pending banners and CSV export are unchanged. End-of-month cancel
isn't available in the backend, so the button keeps its honest "Switch to Free" (immediate) label.

**F2 — Settings.** The section menu now has Business, Voice & audience, Channels (red count of
pages that need reconnecting), Appearance, Login & security, Payments & plans and Accessibility,
with icons. New: Verification row (Approved / Waiting / Sent back), Channels section (the
Connected accounts list embedded, Reconnect / Disconnect / Connect work as on the page), System
theme card, Payments & plans (plan + wallet + link to billing), Accessibility as its own section,
and "Your data": Export my data (JSON of account without password, brand profile, posts, wallet,
tickets) and Delete account (type your email; new `DELETE /api/auth/me`, owners only). Reconnect
buttons around the app now open Settings › Channels; the /social page and its nav item stay.
The mockup's two-factor switch is not shown: the app has no 2FA.

**F3 — Help desk.** New `/help` page and "Help desk" sidebar item (Account group). Left: search
(title, #number, topic), tickets with Open / Replied / Resolved badges and "#N · Joel replied 12m
ago", and an "Ask the assistant" card (same support bot; "Ask a person instead" fills a new
ticket). Right: the conversation (same Stream chat as the Help panel, your messages green, attach
button, Mark resolved, rating once resolved) or the New ticket form (topic + urgency). On phones
the list and conversation swap. Notifications' "Open ticket" and Billing's "Talk to us" open it.
The slide-over Help panel (⌘/) stays, with voice and video calls.

**F4 — Admin overview.** Greeting header ("Good afternoon, Mika · Monday, Nov 2 · 2 permits and 0
tickets waiting") with Review permits. New top block: 4 stat cards (Businesses + new this month,
Permits to review + oldest, Payments to verify + total, Open tickets + high/critical), "Sign-ups,
last 14 days" bars from the users list, and System status (API with latency, Database, AI
generation, Zernio publishing, PayMongo incl. Test mode) from the new
`GET /api/admin/system-status` (admin only; yes/no flags, never key values) plus the Allow
registrations switch (same local setting as the Settings tab). The existing date-range KPIs,
growth / retention charts, latest activity and Needs attention stay below, under "For the dates
above". AI / Zernio / PayMongo show "Set up" (configured), not a live ping.

**F5 — Verification.** Tabs read Pending / Approved / Sent back / All. Three panes: the queue
(business, document type, age), the document viewer (file name, Zoom for images, Open in a new
tab) and a right rail (business details, a Checks list for the reviewer — not saved, a "Pick a
reason" select + note to the owner, Approve / Send back). The rail sits under the viewer below
1536px. Send back stores reason + note as the existing rejection reason; the R key still opens
the reason dialog, A still approves, ↑/↓ still move.

**F6 — Support inbox.** Already had the mockup's lists, filters, thread, notes, saved replies and
rail. Added to the rail's Business section: Verification (Approved / Waiting / Sent back / Not
submitted) and Channels (FB ✓ · IG · expired) from the new staff-only
`GET /api/staff/owners/:userId/summary` (read-only; never creates a Zernio profile; "—" if
Zernio can't be reached). "Earlier tickets" is now "Other tickets".

**F7 — Auth, Brand DNA, Verification.** Login: "Forgot password?" sits on the Password label
line, a "Kept safe" divider heads the trust list, and "Staff sign in" links to the staff login.
Sign up: "Log in instead" replaces Home in the top bar; its own 3-step wizard (Account / Business
/ Verify) stays. The onboarding stepper reflects the app's real order — 1 Account, 2
Verification, 3 Brand DNA: on the verification screen it sits in the top bar with a Help desk
button (the same help panel), and Brand DNA shows it above the form. Verification adds "While you
wait" cards (Brand DNA next, connect pages, Help desk). City ("Where are you?") and Language are
in Settings once the migration runs (see Migrations). Not added: the mockup's testimonial quote
(it would be a made-up customer).

### Phase 2: new endpoints (all additive, Zod-validated like the rest)
- `POST /api/social/unschedule` `{ postId }`: removes the queued Zernio post and sets the post back to Draft (calendar detail panel "Unschedule"). The Zernio `DELETE /posts/:id` call should be checked against Zernio's docs.
- `DELETE /api/auth/me` `{ confirmEmail }`: owners delete their own account (Settings › Your data). Staff accounts get 403.
- `GET /api/admin/system-status` (admin only): yes/no flags for the API, database (with latency), AI, Zernio, PayMongo (incl. test mode) and chat. Never returns key values.
- `GET /api/staff/owners/:userId/summary` (admin + support): the owner's verification status and connected channels for the support rail. Read-only; never creates a Zernio profile.

### Phase 2 hand-test list
1. Month planner: pick next month, 8 posts, two dates, a note → Generate → watch the cards fill → Add to calendar.
2. Calendar: open a draft → Approve and schedule in the detail panel → it shows as Scheduled; Unschedule brings it back to Draft.
3. Drag a post to another day in the month grid (one post per day still enforced).
4. Reconnect a channel from a Held post (detail panel → Reconnect, or Settings › Channels).
5. Insights: tick two posts → Compare; Export CSV from the download menu.
6. Plan and billing: Buy 1 extra post → the Post studio opens on a new post; once this month's posts are used up, writing it offers the paid extra post (₱150 from the wallet).
7. Help desk: open a ticket, reply with a screenshot, Mark resolved; from the support inbox, reply and add an internal note.
8. Admin: Verification → pick a reason + note → Send back; another one → Approve. Overview shows system status.
9. Settings: Export my data downloads JSON; Delete account needs your email typed (try on a test account).

# Phase 3

**3 — Help panel tabs did nothing for owners under review.** Cause: on the verification screen the
help panel is mounted inside the app's sticky top `<nav class="glass-panel">`, which has
`backdrop-filter: blur(12px)`. A filter / backdrop-filter / transform on an ancestor makes it the
containing block for `position: fixed` children, so the panel's `fixed inset-y-0` resolved to the
60 px nav instead of the viewport: header and tab bar showed, the body between them was 0 px tall,
so tabs switched but nothing appeared. (Checked with `elementFromPoint` on the tabs and by walking
the panel's ancestors' computed styles; server routes, Stream token, ticket fetch and the assistant
have no verification gate and returned fine.) Fix: `HelpPanel` renders through `createPortal` to
`document.body`, so it is viewport-fixed from any parent (verification bar, owner app, Brand DNA).
Tested with a pending account: Home, Messages (own tickets only) and Assistant all open full height.

**1 — "Not sent yet" tray removed.** MonthGrid no longer has the left "Not sent yet · Overdue / This
week / Later" panel; the 7-day grid takes the full card width (the timeline's "Not sent yet" lane is
a row, not a panel, and stays). Those posts are still in their day tile (drag still works), the List
view, Post studio's draft groups and the stat cards; the tour step pointing at the tray is gone.

**5 — No more native dropdowns.** Added shadcn select, command, popover-based `IndustryPicker`
(searchable, keyboard, check on the chosen item) for Industry in Brand DNA and Settings, and a
`KwSelect` wrapper (shadcn Select) for every other `<select>`: admin role + plan, Insights range,
support priority, verification reason, planner month, planning-modal day. Options unchanged.
"Other" shows "What's your niche?" (max 60). Before, "Other" had no free text; the niche is now
stored in the existing `brand_profiles.industry` text column as `Other: <niche>` for that profile
only (the server already accepts up to 200 chars, so no server or DB change and no migration); it
is never added to the list, reloads as "Other" + the niche, and the AI prompts get just the niche.
(The shadcn CLI also added cmdk, date-fns, react-day-picker and bumped recharts 3.5 → 3.8 for the
calendar / chart / sidebar components used in later items.)

**8 — Collapsible sidebar (shadcn Sidebar).** Owner, support and admin shells now sit in shadcn's
`SidebarProvider` + `<Sidebar collapsible="icon">` (our item markup inside, so tour anchors and the
staff colours stay): top-bar toggle and ⌘/Ctrl+B, icon rail with tooltips, badges become dots,
quota card hidden, account button avatar-only, state remembered per device (`kawayan_sidebar_open`),
phones (< 768 px) get shadcn's Sheet drawer (the admin's phone tab strip stays too). The width
animates 200 ms with cubic-bezier(0.2, 0.8, 0.2, 1) (none with reduced motion); the inset is flex-1
so pages reflow and charts / the calendar resize via their ResizeObservers. Shared glue in
`layout/shellSidebar.tsx`.
