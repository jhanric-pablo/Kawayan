# Kawayan Functional Scope — Feature Checklist

Status legend: **Done** = implemented and verified in codebase · **N/A** = covered by another item or out of current scope · **Enhanced** = was partial; recently improved

Last updated: June 2025

---

## Content & Calendar

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Trial users can generate **8 posts** | **Done** | `utils/tierLimits.ts` (`TRIAL_POST_LIMIT`), `ContentCalendar.tsx`, `databaseService.assertTierAllowsNewPost` |
| Pro users can generate **16 posts** | **Done** | `utils/tierLimits.ts` (`PRO_POST_LIMIT`), batch + DB enforcement |
| User can view an **Interactive Editorial Calendar** | **Done** | `ContentCalendar.tsx`, `ScheduleXCalendarView.tsx` (Schedule-X grid/list, day panel, ADD pills) |
| Calendar shows the **monthly content schedule** | **Done** | `mapScheduleXEvents.ts`, posts + ideas per day |
| User can **schedule** generated content | **Done** | Side panel Schedule → `status: 'Scheduled'` → `persistPost` |
| System produces **automated scheduling data** | **Done** | `generateContentPlan`, `normalizeIdeasToBatchCount`, `getScheduleDayRange` (today-forward for current month) |
| **Add-on module** for supplemental posts | **Done** | `handleAddOn` (₱150), `addon-` ID bypasses tier cap, ADD pill on empty cells |
| User can **manage content before scheduling** | **Done** | Caption edit, AI rewrite, image regen, photo upload, virality, Save Draft |
| User can **view the content calendar** | **Done** | Default post-login view (`App.tsx` → `ViewState.CALENDAR`) |

---

## Growth Insights & Analytics

| Requirement | Status | Evidence |
|-------------|--------|----------|
| User can access **Growth Insights Dashboard** | **Done** | `InsightsDashboard.tsx`, nav label **Growth Insights** |
| Dashboard shows **engagement metrics** | **Done** | Followers, views, interactions, likes per platform (`socialService` + extension sync) |
| Dashboard translates metrics into **visual charts** | **Enhanced** | Bar chart — engagement by channel (`recharts`) |
| Dashboard demonstrates **digital ROI** | **Enhanced** | ROI card: estimated reach value vs wallet spend |
| User can access **analytics from the platform** | **Done** | Browser extension sync (Facebook, Instagram, TikTok) |

---

## Admin & Billing

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Admin can **verify payment status** | **Enhanced** | **Billing** tab → pending transactions + **Verify Payment** (`/api/admin/pending-transactions`, `/api/admin/wallet/approve`) |
| Admin can manage **active billing cycles** | **Done** | Users tab → subscription plan + `expiresAt` (`adminUpdateSubscription`) |
| Admin can track **aggregate user growth** | **Done** | Overview → User Growth chart (monthly signups) |
| Admin can track **user retention rates** | **Enhanced** | 30-day retention stat + monthly retention bar chart (`getAdminStats.retentionRate`, `churnData`) |

---

## Integrated Help Desk

| Requirement | Status | Evidence |
|-------------|--------|----------|
| System has an **Integrated Help Desk** | **Done** | `SupportWidget.tsx`, `SupportDashboard.tsx`, `AdminDashboard` Help Desk tab, live calls |
| Help desk manages **technical concerns** | **Enhanced** | Ticket category **Technical** + quick-submit from widget menu |
| Help desk manages **billing concerns** | **Enhanced** | Ticket category **Billing** + agent wallet sidebar + category filters |
| Ticketing system starts at ID **1001** | **Enhanced** | `getNextTicketNum()` — sequential from 1001 (`databaseService`, `server.js`) |

---

## Notes

- **Trial** maps to subscription tier `FREE` in code; UI may label it “Free Trial”.
- **Add-on posts** use `addon-{timestamp}` IDs to bypass the monthly tier cap after wallet payment.
- **ROI** uses an estimated ₱0.05 per reach unit (views + interactions + likes + followers); adjust in `InsightsDashboard.tsx` if business rules change.
- **Retention** is approximated from distinct monthly posters vs cumulative user base (no `deleted_at` cohort churn yet).

## Related docs

- [USER_GUIDE.md](./USER_GUIDE.md) — end-user flows
- [SYSTEM_MANUAL.md](./SYSTEM_MANUAL.md) — admin & support operations
- [PAYMENT_SETUP.md](./PAYMENT_SETUP.md) — wallet & Xendit verification
