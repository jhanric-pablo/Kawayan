# Kawayan AI - System Architecture

This document provides a high-level overview of how Kawayan AI is structured and how data flows through the system.

## 1. High-Level Design

Kawayan AI follows a **Full-Stack Client-Server Architecture** with a decoupled service layer.

```
[ User Browser ] <---> [ Express API (Port 3001) ] <---> [ SQLite DB ]
       ^                          |
       |                          v
       +-------------------> [ Third-Party APIs ]
                             (Gemini, Xendit, FB/IG)
```

## 2. Component Layers

### A. Frontend (React/Vite)
- **Framework:** React 19 with TypeScript.
- **Styling:** Tailwind CSS (Mobile-first, Responsive).
- **Icons:** Lucide-React.
- **Charts:** Recharts.
- **State Management:** React `useState` and `useEffect` hooks for local state, with a dedicated `paymentService` and `databaseService` for persistent data.

### B. Service Layer (Frontend Services)
Located in `/services`, these modules act as the bridge between the UI and the Backend API.
- `paymentService.ts`: Handles wallet fetching, invoice creation requests, and plan upgrades.
- `socialService.ts`: Handles OAuth redirection and Graph API insight fetching.
- `geminiService.ts`: Direct client-side integration with Google's AI models.
- `jwtService.ts`: Manages token verification and secure local storage of sessions.

### C. Backend API (Node.js/Express)
- **Entry Point:** `server.js`
- **Authentication:** JWT-based middleware (`authenticateToken`).
- **Authorization:** Role-based access control (Admin vs. User).
- **Webhooks:** Specialized endpoints (e.g., `/api/webhooks/xendit`) to handle external event notifications.

### D. Database Layer (SQLite)
- **Engine:** `better-sqlite3` for high-performance synchronous operations.
- **Persistence:** All data is stored in `kawayan.db`.
- **Integrity:** Foreign keys and Check constraints ensure data consistency.
- **Triggers:** Automatic `updated_at` timestamps for all major tables.

## 3. Core Data Workflows

### AI Content Generation
1. UI requests a Content Plan via `geminiService`.
2. Service calls Google Gemini API.
3. Received JSON is displayed in the Calendar and saved to the SQLite DB via the Backend API.

### Automated Payments
1. User clicks "Top Up" in `Billing.tsx`.
2. Backend generates a Xendit Invoice and returns a URL.
3. User pays on Xendit.
4. Xendit sends a POST request to `/api/webhooks/xendit`.
5. Backend verifies the token, approves the transaction, and updates the SQL `wallets` table.

### Social Connectivity
1. User clicks "Connect" in `InsightsDashboard.tsx`.
2. Frontend redirects to Facebook/TikTok OAuth page.
3. *Future:* Callback handler processes the `code`, exchanges it for a token, and saves it to the DB.
