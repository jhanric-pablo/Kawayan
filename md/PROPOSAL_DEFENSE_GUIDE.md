# Kawayan AI — Capstone Proposal Defense Guide (July 1)

Use this guide to **study the system** and **explain it honestly** to the panel.  
Your situation is normal: many groups bring only wireframes or Figma at proposal stage. You built more — that is a **strength**, not a problem, if you frame it correctly.

---

## 1. The Dilemma (and the honest answer)

| What the panel expects | What you actually have |
|------------------------|-------------------------|
| Proof that the idea is **feasible** | A **working functional prototype** with real login, database, AI, payments, and dashboards |
| Clear **objectives** and **methodology** | Agile/iterative build with traceable features (`FEATURE_CHECKLIST.md`) |
| Something that **looks like** the final system | High-fidelity UI that previews the intended product — **not** a deployed commercial SaaS |

### One sentence you can say to the panel

> **"At proposal stage, we are not presenting a finished commercial product. We are presenting a high-fidelity functional prototype that proves our design works end-to-end, while full production deployment, hardening, and scale testing remain part of our implementation phase."**

That is accurate and defensible.

---

## 2. Three levels of "prototype" (know where you sit)

| Level | What it is | Your project |
|-------|------------|--------------|
| **Low-fidelity** | Wireframes, slides, mockups only | You went **beyond** this |
| **Mid-fidelity** | Clickable UI, fake data | You went **beyond** this |
| **High-fidelity functional prototype** | Real code, real DB, core flows work in demo environment | **This is you** |
| **Production system** | Hosted, secured, load-tested, legally compliant at scale | **Not yet** — this is capstone **implementation** |

Panels often say "prototype" meaning *"show us it can work."* You did that — with more depth than most proposal groups.

---

## 3. What to call it (words that work with evaluators)

**Say this:**
- "High-fidelity **functional prototype**"
- "**Proof-of-concept** implementation"
- "**Working demo** of the proposed system"
- "Core modules implemented for **feasibility validation**"

**Avoid saying this (unless they ask):**
- "Finished product"
- "Fully deployed system"
- "Production-ready platform"
- "Complete and bug-free"

---

## 4. What IS working (safe to demo live)

Use seeded accounts from `md/ACCOUNTS.md`.

| Module | What to show | One-line explanation |
|--------|--------------|----------------------|
| **Registration & TOS** | Sign up flow, Terms acceptance | Legal/compliance requirement for MSME onboarding |
| **Business verification** | Upload doc → pending → admin approves | Trust layer before full access |
| **Brand DNA** | 4-step survey | Personalizes AI output to the business |
| **Content calendar** | Month view, generate batch, edit caption/image | Core value: AI-assisted planning for SMEs |
| **Billing / wallet** | Balance, top-up (Xendit sandbox) | Philippine payment context (GCash/Maya) |
| **Growth Insights** | Charts + extension sync | Analytics without official API cost |
| **Support** | Ticket + real-time on support dashboard | Help desk for non-technical users |
| **Admin** | Verification queue, users, stats | Governance for the platform operator |

**Best demo account (least friction):**  
`cafe@kawayan.ph` / `Password123!` — pre-verified, has sample data after seed.

**Staff demo:**  
`support@kawayan.ph` / `Support123!` and `admin@kawayan.ph` / `Admin123!`

---

## 5. What is NOT "production" (say this before they ask)

Be proactive — panels respect honesty.

| Area | Proposal-stage reality | What you will do later |
|------|------------------------|-------------------------|
| **Hosting** | Runs on `localhost` (dev machine) | Cloud deploy, domain, SSL |
| **Database** | SQLite file on one machine | Scalable DB if user base grows |
| **AI** | Needs API key / may be slow; fallback to local Ollama | Optimize prompts, caching, cost controls |
| **Social posting** | Calendar + scheduling in app; **not** auto-posting to Meta/TikTok APIs in all cases | Official API partnerships where allowed |
| **Analytics** | Chrome **extension** reads public/insights pages | Official Insights APIs long-term |
| **Payments** | **Xendit sandbox** / test mode | Live merchant account + compliance |
| **Security** | JWT + bcrypt (good foundation) | Full security audit, penetration test |
| **Users** | Seeded demo accounts | Real MSME pilot users |

**Script:**

> "Some integrations use sandbox or extension-based approaches because official APIs are costly or restricted at prototype stage. The **workflow and data model** are what we are validating now; production integrations are in our implementation roadmap."

---

## 6. Your system architecture (30-second version)

Memorize this flow for the panel:

```
MSME registers → accepts TOS → submits business docs → Admin verifies
    → Brand DNA setup → AI generates content plan → Calendar scheduling
    → Wallet/top-up (Xendit) → Insights (extension sync) → Support if needed
```

**Tech stack (one breath):**  
React + Vite frontend, Node/Express API, SQLite database, JWT auth, Socket.io for real-time support, AI via cloud/local LLM, Xendit for payments.

---

## 7. Recommended 7-minute demo flow (proposal day)

Practice this until smooth. Have **backup screenshots** if Wi‑Fi or AI fails.

| Min | Who | Action |
|-----|-----|--------|
| 0:00 | Speaker A | Problem: Filipino MSMEs lack time/tools for consistent social media |
| 0:45 | Speaker A | Objectives: AI content, calendar, analytics, payments, support — show title slide |
| 1:15 | Speaker B | Login as `cafe@kawayan.ph` → show **calendar** (main dashboard) |
| 2:00 | Speaker B | Open one post → show caption + image (pre-generated is OK; live AI is bonus) |
| 2:45 | Speaker B | **Growth Insights** tab — one chart, mention extension |
| 3:15 | Speaker C | **Billing** — wallet balance (don't need live payment) |
| 3:45 | Speaker C | **Support widget** — create ticket; switch to support login → ticket appears |
| 4:30 | Speaker C | **Admin** — verification queue or user list (30 sec) |
| 5:00 | Speaker A | "This is our **functional prototype**; implementation phase = deploy, pilot MSMEs, harden" |
| 5:30 | All | Q&A |

**If AI generation is slow:** Say *"The AI module is connected; for time we will use pre-seeded content to show the workflow."*

**If something breaks:** Say *"We are in a development environment; the designed flow is [describe steps]. Production deployment will address stability."*

---

## 8. How to answer hard panel questions

### "Bakit mukhang tapos na? Hindi ba prototype lang?"

> "Yes, proposal stage po. What you see is a **functional prototype** — real modules wired together to prove feasibility. Hindi pa po ito commercially deployed. Ang goal namin sa proposal ay ipakita na **kayang gawin** ang design: registration, verification, AI calendar, billing, analytics, at support. Ang production hardening, cloud hosting, at full API integrations ay bahagi ng implementation phase."

### "Gumagana ba lahat?"

> "The **core user journey** works in our demo environment: login, verification gating, brand setup, calendar, wallet, insights, and support. Some features use sandbox payments and extension-based analytics because official APIs are limited at this stage. We document what is complete vs. enhanced in our feature checklist."

### "Ano ang contribution ninyo vs existing tools?"

> "We combine **Philippine context** in one place: Taglish AI content, MSME verification, GCash/Maya-style wallet via Xendit, local support desk, and insights tuned for Facebook/Instagram/TikTok — aimed at owners who are not marketing experts."

### "Ano ang methodology?"

> "Agile/iterative development: requirements from our paper → modular implementation → functional prototype for validation → documentation (`SYSTEM_GUIDE.md`, feature checklist). We prototype early to reduce risk before final implementation."

### "Paano ninyo sine-secure ang data?"

> "JWT authentication, role-based access (user/support/admin), bcrypt passwords, verification documents stored server-side, Terms of Service acceptance on register. Full security audit is planned for implementation."

---

## 9. Study checklist (before July 1)

### Must know by heart
- [ ] Problem statement and 3–5 objectives (from your paper)
- [ ] What a **functional prototype** means vs **final system**
- [ ] Demo login credentials (`md/ACCOUNTS.md`)
- [ ] 7-minute demo path (section 7)
- [ ] One limitation you will state honestly (sandbox, localhost, or extension)

### Should be able to explain
- [ ] User roles: **MSME user**, **support**, **admin**
- [ ] Why business **verification** exists
- [ ] How **AI** fits (content plan + caption/image)
- [ ] Why **Xendit** (Philippine payments)
- [ ] How **support real-time** works (Socket.io — high level)

### Optional deep dive (if panel is technical)
- [ ] `md/ARCHITECTURE.md` — diagram
- [ ] `md/FEATURE_CHECKLIST.md` — Done vs Enhanced
- [ ] `md/SYSTEM_GUIDE.md` — full reference

### Night before
- [ ] Run `npm run dev:full` and test demo path once
- [ ] Run `./seed.sh` if data looks empty
- [ ] Export 5–8 screenshots as backup
- [ ] Charge laptop; use hotspot if venue Wi‑Fi is bad

---

## 10. Slide structure suggestion (proposal deck)

1. Title + group members  
2. Problem (MSME social media pain)  
3. Objectives  
4. Proposed solution (Kawayan AI overview)  
5. **Scope for proposal:** functional prototype vs final implementation (use table from section 5)  
6. System architecture diagram  
7. Methodology (Agile + prototyping)  
8. **Live demo** (or embedded video)  
9. Timeline: Proposal → Implementation → Testing → Final defense  
10. Thank you / Q&A  

**Important:** Put slide 5 **before** the demo so the panel already knows you are not claiming a finished product.

---

## 11. Closing statement (memorize)

> "In summary, Kawayan AI at proposal stage is a **high-fidelity functional prototype** that demonstrates our intended MSME platform: verified onboarding, AI-assisted content calendar, local payments, analytics, and integrated support. We built enough working features to prove technical and design feasibility. Our next phase is deployment, pilot testing with real MSMEs, and production hardening. Thank you."

---

## Quick reference

| Item | Value |
|------|--------|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Start command | `npm run dev:full` |
| Demo user | `cafe@kawayan.ph` / `Password123!` |
| Admin | `admin@kawayan.ph` / `Admin123!` |
| Support | `support@kawayan.ph` / `Support123!` |

Good luck on July 1.
