# Kawayan AI - API Integration & Architecture Guide

This document details the technical implementation of the "Legit" services layer in Kawayan AI. It explains how we simulate enterprise-grade integrations (Facebook, Xendit) and how we utilize real APIs (Gemini, Google Trends).

## 1. Architecture Overview

Kawayan AI uses a **Service Layer Pattern** to decouple the UI from the data sources. This allows us to switch between our sophisticated local simulation and real production APIs without rewriting the frontend components.

- **Location:** `/services`
- **Key Services:**
  - `geminiService.ts`: Handles all AI and real-time data fetching.
  - `socialService.ts`: Manages OAuth states and Social Graph data.
  - `paymentService.ts`: Manages Wallet ledger and Xendit gateway transactions.

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

## 3. Social Media API (Graph API Simulation)

Since connecting to the real Facebook/Instagram Graph API requires a verified Business App and strict Review permissions, we utilize a **Deterministic Simulation Layer**.

### **How it Works**
1.  **Connect (`connectAccount`):**
    *   Simulates the OAuth 2.0 handshake latency (1.5s).
    *   Generates a mock `access_token` and stores the `connectedAt` timestamp.
2.  **Fetch Data (`getInsights`):**
    *   **Logic:** Instead of returning random numbers every time (which looks fake), we generate data seeded by your unique `connectedAt` timestamp.
    *   **Result:** Your "followers" count will stay consistent across reloads but differ from other users, mimicking a real database record.

### **Real-World Equivalent**
If moving to production, replace `socialService.ts` calls with:
*   **Facebook:** `GET /v18.0/{page-id}/insights`
*   **Instagram:** `GET /v18.0/{ig-user-id}/media`

---

## 4. Payment Gateway (Xendit Simulation)

We simulate the flow of the Xendit Payment Gateway for PH-based transactions (GCash, Maya).

### **Workflow**
1.  **Initiate (`initiateTopUp`):**
    *   Creates a pending transaction record.
    *   Returns a `referenceId` (e.g., `txn_1736...`).
    *   *Real World:* Would call `POST https://api.xendit.co/v2/invoices`.
2.  **User Action:**
    *   User confirms the "Redirect" (browser alert).
3.  **Webhook/Confirm (`confirmPayment`):**
    *   Updates the local Wallet ledger.
    *   Adds a `CREDIT` transaction to history.
    *   Updates the immutable `balance` state.

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
