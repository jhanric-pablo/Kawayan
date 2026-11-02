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
- [ ] Generic top nav for non-dashboard signed-in views (App.tsx)

### Owner screens
- [x] Calendar: header, stats/up-next, toolbar, Segmented view switch
- [x] Calendar: Month grid (`MonthGrid`)
- [x] Calendar: Timeline (`ChannelTimelineTrack`, `TimelinePostCard`)
- [x] Calendar: Agenda / list (`AgendaView`)
- [x] Calendar: `UpNext`
- [x] Calendar: post details (right panel on wide screens, `PostDetailSheet` on small)
- [x] Calendar: `PhonePreview`
- [x] Calendar: empty / loading / error states, delete & reschedule confirms
- [ ] Post studio (`PostComposer`, `FormatPicker`)
- [ ] Month planner (`PlanningModal`, `PostCountPicker`)
- [ ] Insights (`InsightsDashboard`, `insights.css`, compare tray)
- [ ] Billing (plans, wallet, top-up, history, payment dialogs)
- [ ] Settings › Business
- [ ] Settings › Voice & audience
- [ ] Settings › Login & security
- [ ] Settings › Appearance (`SettingsAppearance`)
- [ ] Settings save bar
- [ ] Social accounts (`SocialAccounts`)
- [ ] Help panel incl. Ask the assistant box (`HelpPanel`)
- [ ] Support chat thread (`support/ChatThread`)

### Public / onboarding
- [ ] Landing: header (`LandingNav`)
- [ ] Landing: hero (`HeroShowcase`) — roller removed, auto-cycling shops kept
- [ ] Landing: business-type strip (marquee)
- [ ] Landing: Features
- [ ] Landing: How it works
- [ ] Landing: Why Kawayan (animation unchanged)
- [ ] Landing: pricing / CTA / footer (whatever exists in `LandingPage.tsx`)
- [ ] Log in (`Login`, `AuthShell`, `AuthField`)
- [ ] Sign up (`SignupStory`, `StepProgress`, `PasswordMeter`)
- [ ] Staff login (ADMIN_LOGIN)
- [ ] Reset password (`ResetPassword`)
- [ ] Brand DNA survey (`BrandSurvey`, `VoicePreview`)
- [ ] Verification status (`VerificationStatus`) — pending / rejected / none / upload
- [ ] Legal pages (`LegalPage` privacy + terms)

### Staff
- [ ] Admin console shell (near-black sidebar)
- [ ] Admin › Overview
- [ ] Admin › Users
- [ ] Admin › Verification (`admin/AdminVerification`)
- [ ] Admin › Billing (payments to verify)
- [ ] Admin › Help desk
- [ ] Admin › Audit logs
- [ ] Admin › Settings ("Allow registrations")
- [ ] Support inbox (`SupportDashboard`, `support.css`)
- [ ] Call window (`support/CallWindow`, `callWindow.css`)

### Final pass
- [ ] Dark mode on every screen
- [ ] 390px: no sideways scroll, drawer, stacked grids, tables scroll in their box
- [ ] Reduced motion: no movement, no marquee
- [ ] Remove CSS no longer imported

## Shown in the mockup but not in the app (ideas only, not built)

- **System theme mode.** The brief says "keep light, dark and system", but the app today only has
  Light and Dark (`readThemeFromSession` returns a boolean; App.tsx toggles `.dark`). No system mode
  was added, since that would be a new setting.
- **Integrations hub section** on the landing page (Facebook / Instagram / GCash / Maya diagram).
- **Gallery** of AI images on the landing page (the mockup's `img/*.jpg` samples are not app content).
- **Testimonials wall** ("What shop owners say") — the mockup itself marks them as sample quotes.
- **Contact form** and **FAQ** sections on the landing page.
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
