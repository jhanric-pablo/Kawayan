# Project Architecture

[**⬅ Back: System Manual**](./SYSTEM_MANUAL.md) | [**Next: Database Schema ➔**](./DATABASE_SCHEMA.md)

## Overview
Kawayan AI is built as a hybrid application that bridges modern AI capabilities with local data persistence for Philippine SMEs.

```mermaid
graph TD
    subgraph Frontend [Frontend - React/Vite]
        UI[User Interface]
        DB_Wrapper[Universal DB Service]
    end

    subgraph Backend [Backend - Node/Express]
        API[Express API]
        Scraper[Social Scraper Logic]
        Auth[JWT Auth]
    end

    subgraph Data_Storage [Data Storage]
        SQLite[(SQLite DB)]
        LS[(Local Storage - Browser)]
    end

    subgraph AI_Engines [AI Engines]
        Gemini[Google Gemini - Cloud]
        Ollama[Ollama Qwen - Local]
    end

    subgraph External_APIs [External Integrations]
        Xendit[Xendit Payment Gateway]
        TikTok[TikTok Graph API]
    end

    UI --> DB_Wrapper
    DB_Wrapper --> LS
    DB_Wrapper --> API
    API --> SQLite
    API --> Gemini
    Gemini -- Fallback --> Ollama
    API --> Xendit
    API --> TikTok
    UI <--> Scraper
```

## Tech Stack
- **Frontend**: React (TypeScript) + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend Proxy**: Express.js (Node.js)
- **Database**: SQLite (via better-sqlite3)
- **AI Engines**: 
  - **Cloud**: Google Gemini API (gemini-flash-latest, gemini-2.0-flash)
  - **Local**: Ollama (qwen2.5:7b)
- **Real-time**: Socket.io (for signaling and live updates)

## Core Components
1. **Universal Database Service**: A wrapper that dynamically switches between SQLite (Node) and localStorage (Browser) depending on the environment.
2. **AI Service**: Handles prompt engineering and manages fallbacks between cloud Gemini models and local Ollama instances.
3. **Role-Based Access Control (RBAC)**:
   - **User**: Standard business access (Calendar, Insights, Billing).
   - **Support**: Administrative assistant role (Ticket queue, Call center, User Context).
   - **Admin**: Full system control (User management, Audit logs, System settings).

## Data Flow
1. User interacts with React components.
2. Components call the `UniversalDatabaseService` for data operations.
3. For AI generation, the `geminiService` first attempts Cloud Gemini.
4. If Cloud fails (quota/network), it transparently falls back to the local Ollama server.
5. The backend proxy (`server.js`) handles SQLite persistence and acts as a gateway for external APIs (Xendit, TikTok, Ollama).
