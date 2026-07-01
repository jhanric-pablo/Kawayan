# Kawayan AI — Simple Demo Script (Proposal Defense)

**Read this while clicking.** Keep it simple. If something breaks, use the *playsafe lines* in [brackets].

---

## Before you start (say this once)

> "Good morning/afternoon. We are **[Group Name]**, and this is **Kawayan AI** — a platform we designed for **Filipino MSMEs** who need help with social media content.
>
> Important: at **proposal stage**, what you will see is a **working functional prototype**. It shows that our design **can work end-to-end**. It is **not** a fully deployed commercial product yet — hosting, pilot testing, and production hardening are part of our **implementation phase**.
>
> We will walk you through the main flow in about **[5–7] minutes**."

---

## Part 1 — The problem (30 sec, no clicking)

> "Many small business owners in the Philippines do not have time or budget for a full marketing team. They still need consistent posts on Facebook, Instagram, and TikTok — often in **Taglish** — that match their brand.
>
> **Kawayan AI** helps them **plan, create, schedule, and track** content in one place, with **AI assistance** and **human review** before posting."

---

## Part 2 — Login (MSME user)

**Action:** Open http://localhost:3000 → Sign In  
**Account:** `cafe@kawayan.ph` / `Password123!`

> "First, the **MSME owner** logs in. Only **verified businesses** get full access — we ask for business documents during registration so the platform is used by real SMEs."

*[If login fails: "We are on a local development server; let me use our backup screenshots while we sign in again."]*

---

## Part 3 — Brand DNA (15 sec, optional)

**Action:** If you already have a profile, just mention it. Or briefly show Settings / recall Brand Survey.

> "When a new user registers, they complete a short **Brand DNA** setup — business type, audience, and brand voice. The AI uses this so content is **not generic**; it fits **their** business."

---

## Part 4 — Content Calendar (main demo)

**Action:** Show the calendar — posts on different days.

> "This is the **main dashboard** — the **content calendar**. The owner sees the whole month at a glance: what to post and when."

**Action:** Click one day / open a post in the side panel.

> "Each post has a **caption**, an **image**, and a **virality score**. The score is an **AI estimate** to help owners compare ideas — it is **not a guarantee** of viral results."

**Action:** Optionally edit one word in the caption.

> "The owner can **edit everything**. AI only **suggests**; the human **approves**. Nothing is auto-published without the user's action."

---

## Part 5 — AI generation (optional — only if fast)

**Action:** Click "Plan Month" OR show pre-made posts only.

> "To create new content, the user can ask the system to **plan the month**. The AI suggests post ideas based on their **Brand DNA**, in **Taglish** where appropriate.
>
> Then the system can generate **captions and images** from those ideas. If the network is slow today, we prepared **sample content** to show the workflow — the live AI module is connected in our prototype."

*[Playsafe if AI is slow or fails:]*  
> "The AI service is running in our development environment. For time, we will use **pre-generated posts** to show the **same workflow** — plan, generate, review, schedule."

*[Playsafe if they ask why not live:]*  
> "At proposal stage we prove the **pipeline works**. Full speed and uptime optimization is for implementation."

---

## Part 6 — Scheduling (15 sec)

**Action:** Show Schedule button or a post with "Scheduled" status.

> "When the owner is happy with the caption and image, they **schedule** the post. **Posting to social media** is assisted by our **browser extension** — the owner still has **control**; we do not silently post on their behalf without their step."

---

## Part 7 — Growth Insights (30 sec)

**Action:** Click **Insights** in the nav.

> "**Growth Insights** shows engagement from connected platforms — followers, views, interactions. Data can sync through our **Chrome extension**. This helps owners see if their content is working, together with a simple **ROI view**."

*[Playsafe:]*  
> "Analytics in the prototype use **extension-assisted sync**; official platform APIs can be expanded in the implementation phase."

---

## Part 8 — Billing (20 sec)

**Action:** Click **Billing** — show wallet balance.

> "For sustainability, we integrated **local payments** through **Xendit** — GCash, Maya, and cards. Users top up a **wallet** and subscribe to tiers: **Free** for trial posts, **Pro** for more capacity. In our demo we use **sandbox/test mode**, not live merchant billing."

---

## Part 9 — Support (30 sec)

**Action:** Open support widget (bottom right) OR switch to support account.

**Support login:** `support@kawayan.ph` / `Support123!`

> "Non-technical owners need help. We built an **integrated help desk** — AI chat for quick questions, **tickets** for real issues, and **call** option for support staff.
>
> When a client sends a ticket, the **support agent** sees it on their dashboard in **real time**."

*[Playsafe if widget doesn't update:]*  
> "Support updates are designed for **real-time sync**; in a live venue we may refresh once if the connection drops."

---

## Part 10 — Admin (20 sec, optional)

**Action:** Log out → Staff Portal / `admin@kawayan.ph` / `Admin123!`

> "**Admins** verify business documents, manage users, and oversee the platform. This separates **MSME users**, **support staff**, and **administrators** — role-based access for security."

---

## Closing (memorize this)

> "To summarize: **Kawayan AI** is a **functional prototype** for Filipino MSMEs — verified onboarding, **AI-assisted Taglish content** with **human review**, calendar scheduling, local payments, analytics, and support in one system.
>
> We built enough working features to show our design is **feasible**. Next steps are **deployment**, **pilot with real MSMEs**, and **production hardening**.
>
> Thank you. We are open to your questions."

---

## Quick playsafe phrases (use anytime)

| Situation | Say this |
|-----------|----------|
| Something doesn't load | "We're on a local dev server; the **designed flow** is what we're showing. Production deployment will improve stability." |
| AI is slow | "AI generation depends on network and API; we'll use **prepared sample posts** to demonstrate the workflow." |
| Panel: "Prototype lang ba?" | "Yes — **functional prototype** for proposal. Real modules connected to prove feasibility, not a commercial launch yet." |
| Panel: "Auto-post ba?" | "**No.** User reviews, schedules, then posts with **extension assist**." |
| Panel: "Laging tama ba ang AI?" | "**No.** User can edit; max 2 regenerations; AI **assists**, owner **decides**." |
| Panel: "Anong AI?" | "**LLM** for text and prompts, **image service** for visuals, personalized by **Brand DNA** — details in our documentation." |
| Panel: "Bakit mukhang tapos na?" | "We prototyped early to **reduce risk**. Implementation phase covers cloud hosting, scaling, and full API integrations." |

---

## Demo accounts (keep on a sticky note)

| Role | Email | Password |
|------|-------|----------|
| MSME (best for demo) | `cafe@kawayan.ph` | `Password123!` |
| Support | `support@kawayan.ph` | `Support123!` |
| Admin | `admin@kawayan.ph` | `Admin123!` |

**URL:** http://localhost:3000  
**Start server:** `npm run dev:full`

---

## Minimum demo (if only 3 minutes)

1. Login as `cafe@kawayan.ph`  
2. Show calendar + open one post + edit caption  
3. Show Insights OR Billing (pick one)  
4. Say closing paragraph  

Good luck on July 1.
