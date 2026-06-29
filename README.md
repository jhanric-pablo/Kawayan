# Kawayan AI - Social Media Content Manager for PH SMEs

Kawayan AI is a professional content automation and management platform tailored for Filipino Small and Medium Enterprises (SMEs).

## 🚀 Key Features
- **AI Content Planning**: 7-day and monthly social media calendars in Taglish.
- **Hybrid AI Engine**: Cloud-first (Google Gemini) with Local-fallback (Ollama).
- **Social Media Integration**: TikTok, Facebook, and Instagram connection and insights.
- **Administrative Governance**: Audit logs, user management, and manual wallet adjustments.
- **Dedicated Support**: Built-in help desk with live call capabilities.

## 📖 Documentation
All detailed documentation is available in the [`/md`](./md) directory. Follow the logical flow below:

0. [**System Guide**](./md/SYSTEM_GUIDE.md) — **Capstone submission**. Complete 20-section technical manual ([PDF](./md/SYSTEM_GUIDE.pdf) via `npm run guide:system-pdf`).
1. [**User Guide**](./md/USER_GUIDE.md) - **Start Here**. Overview for SMEs, Support, and Admins.
2. [**Feature Checklist**](./md/FEATURE_CHECKLIST.md) - Functional scope status (done / enhanced / N/A).
3. [**System Manual**](./md/SYSTEM_MANUAL.md) - Technical operations and troubleshooting.
4. [**Architecture**](./md/ARCHITECTURE.md) - Tech stack and system design.
5. [**Database Schema**](./md/DATABASE_SCHEMA.md) - Entity definitions and relationships.
6. [**Developer Guide**](./md/DEVELOPER_GUIDE.md) - Setup, commands, and contributions.
7. [**API Guide**](./md/API_GUIDE.md) - Backend REST endpoint documentation.
8. [**Account Types**](./md/ACCOUNTS.md) - Detailed role and permission matrix.
9. [**Tables Summary**](./md/ALL_TABLES.md) - Quick reference for database tables.
10. [**Social Auth**](./md/SOCIAL_AUTH.md) - Configuration for TikTok/Facebook.
11. [**Payment Setup**](./md/PAYMENT_SETUP.md) - Xendit integration guide.

## 🛠️ Quick Start
1. `npm install`
2. `cp .env.example .env` (Add your Gemini API Key)
3. `npm run dev:full`

---
&copy; 2025 Kawayan AI. Designed for the Philippine SME ecosystem.