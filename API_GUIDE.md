# Kawayan AI - API Integration & Architecture Guide

This document details the technical implementation of the "Legit" services layer in Kawayan AI. It explains how we simulate enterprise-grade integrations (Facebook, Xendit) and how we utilize real APIs (Gemini, Google Trends).

## 1. Architecture Overview

Kawayan AI uses a **Service Layer Pattern** to decouple the UI from the data sources. This allows us to switch between our sophisticated local simulation and real production APIs without rewriting the frontend components.

- **Location:** `/services`
- **Key Services:**
  - `geminiService.ts`: Handles all AI and real-time data fetching.
  - `socialService.ts`: Manages OAuth states and Social Graph data.
  - `paymentService.ts`: Manages Wallet ledger and Xendit gateway transactions.
  - `supportService.ts`: Manages ticketing and help desk workflows.

---

## 2. Google Gemini API (Real Integration)

We use the official Google GenAI SDK to power the core intelligence of the platform.

### **Setup**
Ensure your `.env` file contains:
```env
VITE_GEMINI_API_KEY="your_actual_api_key_here"
```

### **Features & Endpoints**
| Feature | Model Used | Function | Description |
| :--- | :--- | :--- | :--- |
| **Content Generation** | `gemini-2.5-flash` | `generateContentPlan` | Generates JSON-structured content calendars. |
| **Post Drafting** | `gemini-2.5-flash` | `generatePostCaption...` | Creates "Taglish" captions and image prompts. |
| **Image Generation** | `gemini-2.5-flash-image` | `generateImageFromPrompt` | Converts text prompts into base64 images. |
| **Support Bot** | `gemini-2.5-flash` | `chatWithSupportBot` | Context-aware chatbot acting as a support agent. |

---

## 3. Social Media API (Real OAuth Flow)

Kawayan AI uses real OAuth 2.0 redirection to connect accounts.

### **Features & Endpoints**
| Platform | Auth Endpoint | Redirect URI Pattern |
| :--- | :--- | :--- |
| **Facebook** | `facebook.com/v12.0/dialog/oauth` | `/auth/callback/facebook` |
| **Instagram** | `facebook.com/v12.0/dialog/oauth` | `/auth/callback/instagram` |
| **TikTok** | `tiktok.com/auth/authorize` | `/auth/callback/tiktok` |

### **Setup**
Configure your Developer App IDs in `.env`:
```env
VITE_FACEBOOK_APP_ID="your_id"
VITE_INSTAGRAM_APP_ID="your_id"
VITE_TIKTOK_CLIENT_KEY="your_key"
```

---

## 4. Payment Gateway (Xendit Automated)

We use the real Xendit Invoice API to process payments.

### **Workflow**
1.  **Initiate (`create-invoice`):**
    *   Backend calls `POST https://api.xendit.co/v2/invoices` using `XENDIT_SECRET_KEY`.
    *   Creates a `PENDING` record in the SQL `transactions` table.
2.  **User Action:**
    *   User is redirected to Xendit's secure checkout URL.
3.  **Webhook Handler:**
    *   Endpoint: `POST /api/webhooks/xendit`
    *   Xendit sends a signed callback when payment is successful.
    *   System verifies the `x-callback-token` and automatically upgrades the transaction status to `COMPLETED`, instantly updating the user's wallet balance.

### **Security**
Basic Auth is used for outgoing API calls, and Token Verification is used for incoming webhooks.

---

## 5. Google Trends (Real-Time Data)

We fetch **real** trending topics for the Philippines to guide content creation.

### **The Bridge**
Directly fetching Google Trends RSS from a browser is blocked by CORS. We use a bridge API.

*   **Source:** `https://trends.google.com/trends/trendingsearches/daily/rss?geo=PH`
*   **Bridge:** `rss2json.com`
*   **Implementation:** `getRealTrendingTopics()` in `geminiService.ts`.

### **Usage**
This data is automatically pulled when the Content Calendar loads. If the fetch fails (e.g., ad blockers), it silently falls back to Gemini AI generation to ensure UI stability.

---

## 6. Support & VoIP System

We implement a complete ticketing and call center simulation.

### **Features**
*   **VoIP Dialer:** Simulates a WebRTC connection with connection states (`dialing` -> `connected`), live call timer, and mute/video controls.
*   **Ticket System:** A persistent local database of tickets (`Ticket` entity) that syncs between the User Widget and the Support Agent Dashboard.