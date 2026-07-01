# Kawayan AI — Full Tech Stack Guide (Proposal Defense)

Use this to answer **"Ano ang tech stack ninyo?"** and follow-up questions per module.  
Everything below matches the **actual codebase** (`package.json`, `server.js`, `index.html`, `extension/`).

---

## 1. One sentence (memorize)

> **"React + TypeScript frontend on Vite, Node.js Express API, SQLite database, JWT auth, Socket.io for real-time support, Unsloth LLM proxied through our backend for AI, Pollinations.ai for images, Xendit for payments, and a Chrome extension for social insights and posting assist."**

---

## 2. Big picture (architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Browser)                                             │
│  React 19 + TypeScript + Vite  →  http://localhost:3000         │
│  Tailwind CSS · Lucide icons · Recharts · Schedule-X calendar   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST /api/*  +  WebSocket /socket.io
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js)                                              │
│  Express 5 + TypeScript (tsx)  →  http://localhost:3001         │
│  JWT · bcrypt · Multer · SQLite (better-sqlite3)                │
└───────┬─────────────┬──────────────┬──────────────┬─────────────┘
        │             │              │              │
        ▼             ▼              ▼              ▼
   SQLite DB    Unsloth LLM    Xendit API    Ollama (optional)
   kawayan.db   (AI text)      (payments)    (local AI fallback)
        │
        ▼
   Pollinations.ai (AI images via URL)
        │
        ▼
   Chrome Extension (MV3) — insights sync + posting assist
```

---

## 3. Tech stack BY PART (full list)

### A. Frontend — User Interface

| Part | Technology | Used for |
|------|------------|----------|
| **UI framework** | React 19 | All screens and components |
| **Language** | TypeScript 5.8 | Type-safe frontend code |
| **Build tool** | Vite 6 | Dev server, hot reload, production build |
| **Routing** | React Router DOM 7 | `/auth/callback/*` OAuth return routes |
| **Styling** | Tailwind CSS (CDN) | Utility classes + custom design tokens in `index.html` |
| **Design system** | Custom CSS in `index.html` | Glass morphism, Wabi-Sabi green palette, dark mode |
| **Fonts** | Google Fonts — Fraunces + Inter | Headings (display) + UI text |
| **Icons** | Lucide React | Icons across all dashboards |
| **Charts** | Recharts 3 | Growth Insights, Admin stats, Support dashboard |
| **Calendar** | Schedule-X 4 (`@schedule-x/react`, `@schedule-x/calendar`, plugins) | Monthly content calendar grid |
| **Date handling** | temporal-polyfill | Schedule-X date compatibility |
| **Dialogs** | OrganicDialog (custom) | App-wide modal/alert system |
| **State / data** | React hooks + fetch to API | No Redux; services layer pattern |
| **Client storage** | localStorage | JWT token (`kawayan_jwt`), session (`kawayan_session`), view restore |
| **Buffer polyfill** | buffer package | WebRTC / peer compatibility in browser |

**Main UI files:** `App.tsx`, `components/ContentCalendar.tsx`, `components/InsightsDashboard.tsx`, `components/Billing.tsx`, `components/AdminDashboard.tsx`, `components/SupportDashboard.tsx`, `components/SupportWidget.tsx`

**Simple panel answer:**
> "React and TypeScript ang frontend, built with Vite. Tailwind at custom design system para sa UI. Schedule-X para sa calendar, Recharts para sa analytics charts."

---

### B. Backend — API Server

| Part | Technology | Used for |
|------|------------|----------|
| **Runtime** | Node.js | Server environment |
| **Framework** | Express 5 | REST API (`server.js`) |
| **Language** | JavaScript + TypeScript modules | `.js` entry, `.ts` services imported via tsx |
| **Dev runner** | tsx (watch mode) | `npm run server` — auto-restart on changes |
| **HTTP server** | Node `http` + Express | Base HTTP; Socket.io attached to same server |
| **CORS** | cors package | Cross-origin API access (dev) |
| **Env config** | dotenv | `.env` for secrets and ports |
| **File uploads** | Multer 2 | Business verification documents (JPG/PNG/PDF, max 5MB) |
| **Static files** | Express static | Serves built React app from `dist/` |
| **Security headers** | Custom CSP middleware | Content-Security-Policy in `server.js` |
| **Proxy (dev)** | Vite proxy | Frontend `:3000` → backend `:3001` for `/api` and `/socket.io` |

**Ports:**
- Frontend: **3000**
- Backend API: **3001**

**Start command:** `npm run dev:full` (runs server + Vite together via `concurrently`)

**Simple panel answer:**
> "Node.js Express ang backend. REST API siya na nagseserve ng data, auth, payments, at AI proxy. Port 3001 sa development."

---

### C. Database & Data Layer

| Part | Technology | Used for |
|------|------------|----------|
| **Database** | SQLite | Single-file DB (`kawayan.db`) |
| **SQLite driver** | better-sqlite3 12 | Fast synchronous queries in Node |
| **Schema** | `config/database.ts` | Table creation + migrations |
| **Data access** | `services/databaseService.ts` | All CRUD — users, posts, wallet, tickets, etc. |
| **Service pattern** | `services/universalDatabaseService.ts` | Switches SQLite (server) vs localStorage (browser fallback) |
| **Client fallback** | `services/clientDatabaseService.ts` | Browser-only localStorage mode |
| **Migrations** | `services/migrationService.ts` | Schema updates |
| **Seeding** | `seed.ts` + `seed.sh` | Demo accounts and sample data |
| **WAL mode** | SQLite pragma | `journal_mode = WAL` for better concurrency |
| **Foreign keys** | SQLite pragma | `foreign_keys = ON` |

**Main tables:** `users`, `sessions`, `brand_profiles`, `content_plans`, `generated_posts`, `business_verifications`, `wallet_transactions`, `support_tickets`, `social_connections`, `audit_logs`

**Simple panel answer:**
> "SQLite ang database — file-based, madaling i-setup para sa capstone prototype. Parameterized queries para safe sa SQL injection."

---

### D. Authentication & Security

| Part | Technology | Used for |
|------|------------|----------|
| **Password hashing** | bcryptjs (12 rounds) | `services/jwtService.ts` |
| **Tokens** | jsonwebtoken (JWT, HS256) | Login sessions, API auth |
| **Auth middleware** | `authenticateToken` in `server.js` | Protects most `/api/*` routes |
| **Admin guard** | `requireAdmin` in `server.js` | `/api/admin/*` only |
| **Password policy** | `JWTService.validatePasswordStrength` | Min 8 chars, mixed case, digit, special |
| **Input sanitization** | `services/validationService.ts` | Strip HTML/scripts from user input |
| **AI output validation** | `ValidationService` | JSON schema checks on LLM responses |
| **Terms of Service** | `constants/termsOfService.ts` | Required on MSME registration |
| **Audit logging** | `utils/logger.ts` | User actions → `audit_logs` table |
| **Verification files** | Multer + admin-only route | Business docs not publicly accessible |

**Simple panel answer:**
> "bcrypt para sa password, JWT para sa login token, role-based access para sa user, support, at admin."

---

### E. AI Module (Text + Images)

| Part | Technology | Used for |
|------|------------|----------|
| **AI service layer** | `services/geminiService.ts` | Prompts, parsing, fallbacks (legacy filename) |
| **Primary text LLM** | **Unsloth LLM** (OpenAI-compatible API) | Content plans, captions, support bot, trending topics |
| **AI proxy endpoint** | `POST /api/ai/unsloth` in `server.js` | Hides API key from browser |
| **Local AI fallback** | **Ollama** + Qwen 2.5 | `POST /api/ai/local` → `localhost:11434` |
| **Image generation** | **Pollinations.ai** (URL-based) | `generateImageFromPrompt()` — no separate image API key |
| **Validation** | `services/validationService.ts` | Reject bad JSON from LLM |
| **Fallback templates** | `ValidationService` | Taglish templates if AI fails |
| **Usage limits** | `utils/tierLimits.ts` | 8/16 posts per month, ₱150 add-on |
| **Regen cap** | `ContentCalendar.tsx` | Max 2 regenerations per post |
| **Env vars** | `UNSLOTH_API_URL`, `UNSLOTH_API_KEY` | Server-side AI credentials |
| **Legacy (in package.json)** | `@google/genai` | Installed but **not used** in current AI flow |

**AI flow:** Brand DNA → LLM prompt → JSON (caption + imagePrompt + virality) → Pollinations image URL → user edits → schedule

**Simple panel answer:**
> "Unsloth LLM para sa text, proxied sa Express para hindi exposed ang API key. Pollinations.ai para sa images. May Ollama fallback para sa local/offline. Human-in-the-loop — user mag-review bago i-schedule."

---

### F. Content Calendar Module

| Part | Technology | Used for |
|------|------------|----------|
| **Main component** | `components/ContentCalendar.tsx` | Plan month, batch generate, edit posts |
| **Calendar UI** | Schedule-X 4 + custom theme CSS | Month grid + agenda view |
| **Event mapping** | `components/calendar/mapScheduleXEvents.ts` | Posts → calendar events |
| **Custom event UI** | `KawayanMonthGridEvent.tsx` | Post cards on calendar days |
| **Brand inputs** | `components/BrandSurvey.tsx` | Brand DNA survey (4 steps) |
| **Tier logic** | `utils/tierLimits.ts` | Free 8 / Pro 16 posts |

**Simple panel answer:**
> "Schedule-X library ang calendar UI. AI-generated posts naka-map sa month grid. Brand Survey ang nagpe-personalize ng AI output."

---

### G. Payments & Billing

| Part | Technology | Used for |
|------|------------|----------|
| **Payment gateway** | **Xendit API** (`api.xendit.co`) | Invoice creation, GCash/Maya/cards |
| **Service layer** | `services/paymentService.ts` | Wallet fetch, top-up, purchase |
| **UI** | `components/Billing.tsx`, `XenditCheckoutModal.tsx` | Wallet balance, checkout flow |
| **Backend routes** | `/api/wallet/*`, `/api/webhooks/xendit` | Top-up, verify, subscription |
| **Env vars** | `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | Payment credentials |
| **Currency** | PHP (₱) | Philippine Peso |
| **Prototype note** | Sandbox / test mode | Live merchant account = implementation phase |

**Simple panel answer:**
> "Xendit ang payment gateway — GCash, Maya, cards. Prepaid wallet system. Sandbox mode pa sa prototype."

---

### H. Growth Insights & Social

| Part | Technology | Used for |
|------|------------|----------|
| **Dashboard** | `components/InsightsDashboard.tsx` + Recharts | Engagement charts |
| **Social service** | `services/socialService.ts` | Connection state, metrics fetch |
| **Platforms** | Facebook, Instagram, TikTok | Username-based connections |
| **OAuth (partial)** | Meta + TikTok dev APIs | `VITE_FACEBOOK_APP_ID`, `TIKTOK_CLIENT_KEY` |
| **OAuth callback** | `components/AuthCallback.tsx` | `/auth/callback/:platform` |
| **Server scraper** | `scrapeSocialStats()` in `server.js` | Fallback public page fetch |
| **Chrome extension** | Manifest V3 (`extension/`) | Insights sync from platform pages |
| **Extension scripts** | `content_*_insights.js` | Read metrics from FB/IG/TikTok DOM |
| **Posting assist** | `content_facebook.js`, `content_tiktok.js`, etc. | Help user post manually |

**Simple panel answer:**
> "Insights dashboard gamit Recharts. Chrome extension ang nag-sync ng stats from Facebook, Instagram, TikTok — kasi mahal o restricted ang official APIs sa prototype stage."

---

### I. Support & Real-Time Communication

| Part | Technology | Used for |
|------|------------|----------|
| **Help widget** | `components/SupportWidget.tsx` | Tickets + AI assist chat |
| **Support dashboard** | `components/SupportDashboard.tsx` | Agent ticket queue |
| **Ticket service** | `services/supportService.ts` | Create/update/resolve tickets |
| **Real-time layer** | **Socket.io 4** (server + client) | Live ticket updates, call signaling |
| **Realtime service** | `services/supportRealtime.ts` | Socket connection management |
| **Live calls** | `components/CallOverlay.tsx` | Voice/video/screen share |
| **WebRTC** | Native `RTCPeerConnection` | Peer media (not simple-peer in current code) |
| **Signaling** | Socket.io `join-room`, `signal` events | SDP/ICE exchange |
| **STUN servers** | Google + Mozilla public STUN | NAT traversal for WebRTC |
| **AI support bot** | `chatWithSupportBot()` in geminiService | First-line Taglish assist |

**Simple panel answer:**
> "Socket.io para sa real-time tickets at call signaling. WebRTC para sa live voice/video support. AI bot ang first-line assist, tao ang escalation."

---

### J. Admin & Governance

| Part | Technology | Used for |
|------|------------|----------|
| **Admin UI** | `components/AdminDashboard.tsx` | Users, verifications, billing, stats |
| **Charts** | Recharts (Bar, Area) | Growth, retention, revenue |
| **Admin API** | `/api/admin/*` | Users, logs, verifications, wallet approve |
| **Verification queue** | `business_verifications` table | Approve/reject MSME docs |
| **Audit logs** | `audit_logs` table + logger | Who did what, when |

**Simple panel answer:**
> "Admin dashboard — user management, verification approval, pending payments, at audit logs. Recharts para sa analytics."

---

### K. Chrome Browser Extension

| Part | Technology | Used for |
|------|------------|----------|
| **Platform** | Chrome Extension **Manifest V3** | Modern extension standard |
| **Background** | Service worker (`background.js`) | Extension lifecycle |
| **Content scripts** | Platform-specific `.js` files | DOM interaction per site |
| **Permissions** | `activeTab`, `scripting`, `storage`, `tabs` | Read active page, inject scripts |
| **Host permissions** | localhost, TikTok, Facebook, Instagram | Dashboard + social sites |
| **Package** | `extension.zip` | Load unpacked in Chrome |

**Simple panel answer:**
> "Chrome Extension Manifest V3. Nag-aassist sa posting at nag-sync ng insights from social media pages."

---

### L. Development, Build & Testing

| Part | Technology | Used for |
|------|------------|----------|
| **Package manager** | npm | Dependencies and scripts |
| **Concurrent dev** | concurrently | Run server + Vite at once (`dev:full`) |
| **Type checking** | TypeScript `tsc --noEmit` | `npm run typecheck` |
| **Tests** | tsx + custom scripts | `tests/systemTest.ts`, `tests/dbTest.ts` |
| **Seeding** | `./seed.sh` → `seed.ts` | Reset DB + demo data |
| **PDF guide** | `scripts/generate-system-guide-pdf.mjs` | `npm run guide:system-pdf` |
| **Git** | Git | Version control |

**npm scripts:**

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite frontend only (port 3000) |
| `npm run server` | Express backend only (port 3001) |
| `npm run dev:full` | Both together |
| `npm run build` | Production React build → `dist/` |
| `npm run test` | System integration test |
| `npm run test:db` | Database test |

---

### M. External APIs & Services (third-party)

| Service | Purpose | Config / Endpoint |
|---------|---------|-------------------|
| **Unsloth LLM** | AI text (captions, plans, bot) | `UNSLOTH_API_URL`, `UNSLOTH_API_KEY` |
| **Ollama** | Local LLM fallback | `POST /api/ai/local` → port 11434 |
| **Pollinations.ai** | AI image URLs | Built into `geminiService.ts` |
| **Xendit** | Payments (GCash, Maya, cards) | `XENDIT_SECRET_KEY` |
| **Google STUN** | WebRTC NAT traversal | Public STUN servers |
| **Meta (Facebook/Instagram)** | OAuth / social (partial) | `VITE_FACEBOOK_APP_ID` |
| **TikTok Developer** | OAuth / social (partial) | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| **Google Fonts** | Fraunces + Inter | CDN |
| **Google Gemini** | Legacy / optional | `GEMINI_API_KEY` — not primary AI in current code |

---

### N. Installed but NOT actively used in source

Be honest if a technical panel asks:

| Package | Status |
|---------|--------|
| `@google/genai` | In `package.json`; AI uses Unsloth proxy instead |
| `simple-peer` | Installed; calls use native `RTCPeerConnection` |
| `three` | Installed; no imports found in app source |
| `zod` | Installed; validation uses custom `ValidationService` |
| `@preact/signals` | Installed; React state used instead |
| `backend/*.php` | Legacy PHP files in repo; **active stack is Node/Express** |

---

## 4. Tech stack BY FEATURE (quick lookup)

| Feature | Frontend | Backend | Database | External |
|---------|----------|---------|----------|----------|
| Login / Register | React, Login.tsx | Express, JWT, bcrypt | `users`, `sessions` | — |
| Business verification | VerificationStatus.tsx | Multer, admin routes | `business_verifications` | — |
| Brand DNA | BrandSurvey.tsx | `/api/profiles` | `brand_profiles` | — |
| AI content plan | ContentCalendar.tsx | `/api/ai/unsloth` | `content_plans` | Unsloth LLM |
| AI captions/images | ContentCalendar.tsx | AI proxy | `generated_posts` | Unsloth + Pollinations |
| Calendar | Schedule-X | `/api/posts`, `/api/plans` | `generated_posts` | — |
| Billing / wallet | Billing.tsx | `/api/wallet/*` | `wallet_transactions` | Xendit |
| Growth insights | InsightsDashboard.tsx | `/api/social/*` | `social_connections` | Chrome extension |
| Support tickets | SupportWidget.tsx | `/api/support/*` | `support_tickets` | Socket.io |
| Live calls | CallOverlay.tsx | Socket.io signaling | — | WebRTC + STUN |
| Admin panel | AdminDashboard.tsx | `/api/admin/*` | all tables | — |
| Social posting | Extension + dashboard | — | — | Chrome extension |

---

## 5. Simple panel Q&A (tech stack)

### "Ano ang frontend ninyo?"
> React, TypeScript, at Vite. Tailwind CSS ang styling. Lucide icons at Recharts charts.

### "Ano ang backend?"
> Node.js Express REST API. TypeScript services. Port 3001.

### "Ano ang database?"
> SQLite gamit better-sqlite3. File-based, good for prototype.

### "Paano ang AI?"
> Unsloth LLM proxied sa Express. Pollinations.ai para sa images. Optional Ollama locally.

### "Paano ang payments?"
> Xendit API — GCash, Maya, cards. Wallet system sa SQLite.

### "Paano ang real-time support?"
> Socket.io para sa signaling at live updates. WebRTC para sa calls.

### "Bakit Chrome extension?"
> Para sa insights sync at posting assist — hindi kami umaasa sa expensive official APIs sa prototype.

### "Ano ang hindi ninyo ginagamit?"
> Honest: Google Gemini SDK naka-install pero Unsloth ang primary AI. PHP backend files ay legacy — active stack is Node.

---

## 6. One-page cheat sheet (print this)

```
FRONTEND:  React 19 + TypeScript + Vite 6 + Tailwind + Lucide + Recharts
BACKEND:   Node.js + Express 5 + tsx
DATABASE:  SQLite (better-sqlite3) → kawayan.db
AUTH:      JWT + bcrypt + RBAC (user/support/admin)
AI TEXT:   Unsloth LLM via POST /api/ai/unsloth
AI IMAGE:  Pollinations.ai URLs
AI LOCAL:  Ollama via POST /api/ai/local (optional)
CALENDAR:  Schedule-X 4 + temporal-polyfill
PAYMENTS:  Xendit API (sandbox at prototype)
REALTIME:  Socket.io 4 + WebRTC (STUN)
EXTENSION: Chrome MV3 — insights + posting assist
PORTS:     3000 frontend | 3001 backend
START:     npm run dev:full
SEED:      ./seed.sh
```

Good luck — know the stack per module, be honest about prototype vs production.
