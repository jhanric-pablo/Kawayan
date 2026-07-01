# Kawayan AI — AI Module Study Guide (Proposal Defense)

Use this to prepare for panel questions about **how AI works** in your system.  
Everything below matches the **actual code** in `services/geminiService.ts`, `server.js`, and `ContentCalendar.tsx`.

---

## 1. Elevator pitch (30 seconds)

> "Kawayan AI uses a **hybrid AI pipeline**: a large language model generates **Taglish** captions and monthly content plans personalized by each MSME's **Brand DNA** profile. Images are produced from AI-written prompts via an image API. The user **always reviews and edits** before scheduling — the AI assists, it does not auto-publish. If the model fails, we have **validation and fallback templates** so the app stays usable during demos."

---

## 2. What AI actually does in Kawayan (4 jobs)

| # | Feature | Function | User sees |
|---|---------|----------|-----------|
| 1 | **Monthly content plan** | 8 or 16 post *ideas* (day, title, topic, format) | "Plan Month" in calendar |
| 2 | **Post generation** | Taglish caption + image prompt + virality score | Preview panel per day |
| 3 | **Image generation** | URL from text prompt | Post thumbnail |
| 4 | **Support chatbot** | Short Taglish replies in widget | "AI Assist" in support bubble |
| 5 | **Trending topics** | 5 PH-relevant topics by industry | Sidebar suggestions |

**Not AI (important to say):** payment processing, verification approval, analytics numbers (from extension sync), ticket routing.

---

## 3. End-to-end AI flow (memorize this diagram)

```
Brand Survey (Brand DNA)
        ↓
  brand_profiles table
        ↓
User clicks "Plan Month" + optional strategy text
        ↓
generateContentPlan(profile, month, count)
        ↓
Prompt built with: business name, industry, audience, voice, themes
        ↓
POST /api/ai/unsloth  →  LLM returns JSON array of ideas
        ↓
ValidationService.validateContentIdeas()  →  save to content_plans
        ↓
User clicks "Batch Create" (or generate single post)
        ↓
For each idea:
  generatePostCaptionAndImagePrompt(profile, topic)
        → caption, imagePrompt, viralityScore, viralityReason
  generateImageFromPrompt(imagePrompt)
        → Pollinations.ai image URL
        ↓
Save as Draft in generated_posts
        ↓
User edits caption / regenerates (max 2) / uploads own photo
        ↓
User clicks Schedule → status: Scheduled
        ↓
Post Now → Chrome extension assists manual posting
```

**Key phrase for panel:** *"Human-in-the-loop — AI drafts, the MSME owner approves."*

---

## 4. Brand DNA — how personalization works

After verification, the user completes **Brand Survey** (`BrandSurvey.tsx`). This creates a `BrandProfile`:

| Field | Example | Used in AI prompt as |
|-------|---------|----------------------|
| `businessName` | Aling Nena's Pastries | Who the post is for |
| `industry` | Food & Beverage | Context / trends |
| `targetAudience` | Working moms in Parañaque | Tone and references |
| `brandVoice` | Friendly Tita, Makulit & Fun, etc. | Style instructions |
| `keyThemes` | Product launches, behind the scenes | Content angles |

**Panel question:** *"Paano niyo ipinapersonal ang AI?"*

> "We inject the Brand DNA fields into every LLM prompt. The model is instructed to avoid generic marketing copy and produce content that only makes sense for that specific business, in **Taglish**, matching their chosen brand voice."

---

## 5. Taglish generation — what you tell the panel

The prompts explicitly require:

- **Natural Taglish** (mix of Tagalog and English) in titles, topics, and captions
- **No generic phrases** (e.g. "Check out our amazing products")
- **Local flavor**: hugot, relatable humor, hyper-local hashtags (3–5 per post)
- **Brand-voice matching** (Professional, Makulit Pinoy, Hugot, Premium, Friendly Tita)

**Sample prompt instruction (from code):**

> *"USE TAGLISH. The 'title' and 'topic' must be in natural, modern Taglish or Filipino."*

**If they ask about accuracy:** Taglish quality depends on the LLM; Qwen/Unsloth-style models handle multilingual text well. Users can **edit every caption** before posting.

---

## 6. Which AI models / services? (be precise)

### Text (captions, plans, support bot)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Primary (current code)** | **Unsloth LLM** via OpenAI-compatible API | Frontend calls `POST /api/ai/unsloth`; server proxies to `UNSLOTH_API_URL` |
| **File name** | `geminiService.ts` | **Legacy name** — service layer for all AI text; not calling Google Gemini in current `generateWithFallback()` |
| **Documented fallback** | **Ollama** (Qwen 2.5:7b) | Server endpoint `POST /api/ai/local` exists; can be wired for offline/demo resilience |
| **Legacy / docs** | Google Gemini | `GEMINI_API_KEY` in `.env.example`; mentioned in older docs and error messages |

**Honest line for proposal:**

> "Our prototype uses an **Unsloth-hosted LLM** (OpenAI-compatible chat API) as the primary text engine, proxied through our Express backend so API keys stay server-side. We designed for a **hybrid cloud + local** strategy — Ollama is available on `/api/ai/local` for privacy and offline fallback during implementation."

### Images

| Layer | Technology |
|-------|------------|
| **Image URLs** | **Pollinations.ai** — prompt encoded in URL, no separate image API key in app |
| **Prompt source** | LLM writes `imagePrompt` in English (better for image models) |
| **Suffix added** | `, high quality, professional photography style, 4k` |

**Panel:** *"Hindi ba same lang sa ChatGPT?"*

> "We use a **multi-step pipeline**: LLM writes structured JSON (caption + image prompt + virality score), then a dedicated image service renders from the prompt. This separates **copy** from **visuals** and lets us swap providers without rewriting the UI."

---

## 6.1 Why free / low-cost AI — and why we did NOT use Gemini (important)

At **proposal / capstone prototype** stage, we intentionally relied on **free or low-cost** AI services. This is a **practical and honest** choice, not a weakness — if the panel asks, say it clearly.

### What we use (and cost)

| Service | Role | Cost at prototype |
|---------|------|-------------------|
| **Unsloth LLM** | Text — plans, captions, support bot | Hosted / team-accessible endpoint (no paid Gemini bill) |
| **Pollinations.ai** | Images from text prompt (URL-based) | **Free** — no separate image API key in app |
| **Ollama + Qwen 2.5** | Optional local text fallback | **Free** — runs on local machine (`/api/ai/local`) |
| **Google Gemini** | Originally planned in docs | **Not used as primary** — see below |

### Why we did NOT use Gemini as the main engine

1. **Free-tier limits** — Google Gemini API has **quota and rate limits** on the free tier. Our workflow calls the LLM **many times per user** (monthly plan + up to 8–16 posts × caption + support bot). That burns through free quota quickly during development, demos, and defense practice.
2. **Capstone budget** — As students building a **functional prototype**, we avoided a paid cloud AI bill. We needed something we could run and demo **repeatedly** without hitting paywalls mid-presentation.
3. **Batch cost risk** — One "Batch Create" = multiple LLM calls. Gemini paid tiers would add real cost per MSME per month at scale; we validated the **pipeline first** with accessible tooling.
4. **Architecture is provider-agnostic** — `geminiService.ts` is a **legacy filename**. The service layer calls `/api/ai/unsloth` today; swapping to Gemini (or Ollama only) is a **backend config change**, not a UI rewrite. `@google/genai` remains in `package.json` for future production use.

### Simple lines for the panel

**"Bakit hindi Gemini?"**

> "Plano po namin ang Gemini sa design docs, pero sa prototype stage **hindi namin siya ginamit as primary** dahil sa **free-tier limits at quota** — maraming LLM calls ang system namin per user per month. Bilang capstone group, **free at low-cost** muna ang pinili namin: Unsloth para sa text, Pollinations.ai para sa images, at Ollama bilang local fallback. Ang importante na na-prove namin ay ang **AI workflow** — Brand DNA, JSON validation, human review — hindi ang specific paid vendor."

**"Hindi ba problema na free lang?"**

> "Para sa **proposal prototype**, oo — feasible at defensible. Ang goal ay ipakita na gumagana ang pipeline. Sa **implementation phase**, pwede naming i-switch sa Gemini o ibang paid LLM kapag may production budget at proper rate limiting. Hybrid design namin — cloud, local, o fallback templates."

**"So ano ang contribution niyo kung free API lang?"**

> "Ang contribution hindi 'nagbayad kami ng Gemini.' Ang contribution ay ang **end-to-end MSME system**: Taglish prompt engineering, Brand DNA personalization, structured JSON output, validation, tier limits, human-in-the-loop scheduling, at fallback kung mag-fail ang API — **Philippine context**, hindi generic chatbot."

### Honest note (do not hide)

- We are **not** claiming state-of-the-art model quality from a free stack.
- We **are** claiming the **system design works**: prompts → LLM → validate → edit → schedule.
- Production roadmap: budget for Gemini or enterprise LLM + API rate limits + optional Ollama for privacy-sensitive clients.

---

## 7. Prompt engineering (show you understand the research)

### Content plan prompt includes:
- Full brand profile
- Exact count (8 or 16 ideas)
- Spread days across month (1–28)
- **OUTPUT ONLY JSON** — reduces parsing errors
- Anti-generic instructions

### Post caption prompt includes:
- Topic + brand identity
- Caption rules (Taglish, emojis, hashtags)
- Image prompt in English
- Virality score 0–100 + short reason

### Optional user strategy:
If the user types a monthly strategy (e.g. "Valentine promo"), the app **prepends** it to each idea topic before generation.

---

## 8. Safety, validation, and fallbacks

### JSON parsing
LLM output is messy. The code:
1. Strips `` blocks (`stripThinking`)
2. Extracts JSON array/object with regex (`extractJson`)
3. Validates schema (`ValidationService`)

### If AI fails completely
| Feature | Fallback |
|---------|----------|
| Content plan | `createFallbackContentIdeas()` — 16 Taglish-style template ideas |
| Single post | `createFallbackPostResponse()` — generic caption (user should edit) |
| Trending topics | `['Sale', 'Weekend', 'Food Trip', 'Payday', 'New Arrival']` |
| Support bot | Message asking user to open a ticket or call human |

**Panel:** *"What if the AI is wrong?"*

> "Three layers: **(1)** prompt constraints and Brand DNA, **(2)** JSON validation — reject malformed output, **(3)** fallback templates so the system never crashes. The MSME **must review** before schedule; we don't auto-post to social networks without user action."

### Regeneration limit
- **Max 2 regenerations** per post (`regenCount`)
- Previous versions saved in `history` JSON
- Prevents API abuse (also in Terms of Service)

### Tier limits (business rules, not AI)
- **Free:** 8 posts/month
- **Pro:** 16 posts/month
- **Add-on:** ₱150 per extra post (`addon-` ID bypasses tier cap)

---

## 9. Virality score — what it is (and isn't)

The LLM returns:
- `viralityScore`: 0–100
- `viralityReason`: short English explanation

**Say this clearly:**

> "Virality score is an **AI-estimated engagement potential**, not a guaranteed prediction. It helps non-expert users compare post ideas. It is **not** trained on their real analytics — that comes from the separate Insights module."

---

## 10. Architecture — why proxy through backend?

```
Browser (React)
    → fetch('/api/ai/unsloth')   // no API key in frontend
        → Express server.js
            → Unsloth API (UNSLOTH_API_URL + UNSLOTH_API_KEY)
```

**Benefits to mention:**
- API keys hidden from client
- Rate limiting possible in implementation phase
- Can swap Unsloth → Gemini → Ollama without changing UI
- Aligns with **service layer pattern** in your paper

---

## 11. AI in Support Widget

`chatWithSupportBot()` in `geminiService.ts`:
- Sends conversation history + user message
- Asks for concise Taglish response
- On failure: directs user to **human ticket** or **Call Us**

**Important:** This is **first-line assist**, not replacing human support — matches your integrated help desk objective.

---

## 12. What AI does NOT do (say proactively)

| Claim | Reality |
|-------|---------|
| Auto-post to Facebook/Instagram/TikTok | **No** — extension assists; user posts manually |
| Guaranteed viral content | **No** — estimate only |
| Trains on user's private docs | **No** — only Brand DNA fields in prompt |
| Video generation | **Out of scope** (per Terms) |
| 100% correct Taglish | **No** — user edits expected |
| Works offline by default | **Needs network** unless Ollama fallback is configured |

---

## 13. Ethical & research angles (panels love this)

1. **Transparency** — User knows content is AI-assisted (TOS section 6).
2. **Accountability** — Business owner reviews before publish.
3. **Verification** — Only verified MSMEs get full AI access (reduces spam/fake businesses).
4. **Resource fairness** — Tier limits + regen cap prevent abuse.
5. **Philippine context** — Taglish, local payments, local support — not a generic Western tool.
6. **Limitations** — Documented in proposal; pilot with real MSMEs in implementation phase.

---

## 14. Likely panel questions + suggested answers

### "Anong AI model ang ginamit niyo?"

> "For text, we use an **Unsloth LLM** exposed through an OpenAI-compatible chat API, proxied by our Node backend. For images, we use **Pollinations.ai** from prompts the LLM generates. We also prepared **Ollama + Qwen 2.5** as a local fallback endpoint for privacy and offline scenarios in the implementation phase."

### "Bakit Taglish?"

> "Our target users are Filipino MSME owners. Taglish is how they and their customers communicate on Facebook and TikTok. We encode that requirement directly in the system prompts and brand voice selection."

### "Paano niyo sine-secure ang API keys?"

> "Keys are in server-side `.env`, not in the React bundle. The browser only calls `/api/ai/unsloth`."

### "Paano kung mali ang generated content?"

> "The user edits captions, can regenerate up to twice, or upload their own image. Scheduling requires explicit user action. We also validate JSON structure before saving."

### "Naka-train ba ang AI sa data ng user?"

> "In our prototype, we **do not fine-tune per user**. Personalization comes from **prompt context** (Brand DNA) sent with each request. Per-user fine-tuning could be a future research extension."

### "Ano ang contribution niyo sa AI — bakit hindi ChatGPT na lang?"

> "We built an **end-to-end MSME workflow**: verification → Brand DNA → calendar → tier limits → scheduling → analytics → support. The AI is one module in a **Philippine-specific SaaS**, not a generic chat interface."

### "Paano niyo ite-test ang AI quality?"

> "Qualitative: demo with seeded businesses (cafe, bakery, tech shop). Quantitative for implementation: user satisfaction survey, edit rate (how much users change AI text), and engagement from Insights after posting. For proposal, we demonstrate **feasibility** of the pipeline."

### "Magkano ang cost?"

> "Sa prototype, **free at low-cost** services: Pollinations.ai para sa images, Unsloth/hosted LLM para sa text, optional **free** Ollama locally. Hindi namin ginamit ang Gemini as primary dahil sa **free-tier quota limits** — maraming API calls ang bawat user. Production phase: need budget for Gemini o paid LLM; tier limits (8/16 posts) at regen cap ang cost control per user."

### "Bakit hindi Gemini? May GEMINI_API_KEY sa .env."

> "Nasa docs at `.env.example` po ang Gemini from earlier design. **Current code** tumatawag sa `/api/ai/unsloth`, hindi direct sa Google. Hindi namin pinili ang Gemini as main engine sa prototype dahil **limited ang free tier** para sa batch generation namin. Ang `geminiService.ts` ay **legacy filename** — service layer lang; pwede i-swap ang provider sa backend without changing the UI."

### "Hybrid AI — ano ibig sabihin?"

> "**Hybrid** means: (1) cloud LLM for quality, (2) optional **local Ollama** for privacy/offline, (3) **template fallbacks** when APIs fail, (4) separate **image service** from text service. We're not locked to one vendor."

### "Real-time ba ang generation?"

> "Batch plan is a few seconds. Full month batch (8–16 posts) takes longer because each post calls LLM + image URL. For proposal demo we may show **pre-seeded posts** if the network is slow."

---

## 15. Demo tips for AI section

1. **Before defense:** Run one successful "Plan Month" + generate **one** post (not full batch).
2. **Show Brand DNA:** Open Settings or mention survey — "AI uses this profile."
3. **Show edit:** Change one word in caption — proves human control.
4. **Show virality score** in post panel.
5. **Backup:** Seeded user `cafe@kawayan.ph` already has posts if live AI fails.
6. **If Unsloth is down:** Say *"Fallback templates activate; in production we'd fail over to Ollama. Gemini is on the roadmap when we have production budget beyond free-tier limits."*

---

## 16. Code locations (if technical panel asks)

| What | Where |
|------|--------|
| AI service (text) | `services/geminiService.ts` |
| Validation & fallbacks | `services/validationService.ts` |
| Unsloth proxy | `server.js` → `POST /api/ai/unsloth` |
| Ollama proxy | `server.js` → `POST /api/ai/local` |
| Calendar UI / batch | `components/ContentCalendar.tsx` |
| Brand inputs | `components/BrandSurvey.tsx` |
| Support bot | `components/SupportWidget.tsx` |
| Tier limits | `utils/tierLimits.ts` |
| Env config | `.env.example` → `UNSLOTH_API_URL`, `UNSLOTH_API_KEY` |

---

## 17. One-page cheat sheet (print this)

```
AI INPUT:  Brand DNA + month + topic + optional strategy
AI OUTPUT: JSON → ideas | caption + imagePrompt + virality
TEXT API:  Unsloth LLM (via /api/ai/unsloth) — free/low-cost at prototype
IMAGE API: Pollinations.ai (free URL from prompt)
LOCAL:     Ollama endpoint ready (/api/ai/local) — free
GEMINI:    NOT primary — free-tier quota too low for our batch calls; planned for production
FALLBACK:  ValidationService templates if API fails
LIMITS:    8/16 posts per month, 2 regens per post
HUMAN:     Edit → Schedule → Extension assist post
NOT AI:    Payments, verification, analytics sync
```

Good luck — know the flow, be honest about prototype limits, and emphasize **Taglish + Brand DNA + human review**.
