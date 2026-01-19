# Kawayan AI - Philippine SME Content Manager

Kawayan AI is an intelligent social media content generation platform tailored specifically for Philippine MSMEs (Micro, Small, and Medium Enterprises). It uses Google's Gemini 2.5 Flash to generate culturally resonant "Taglish" content, images, and schedules.

## 🌟 Key Features

- **Taglish Content Generation:** Creates captions that sound natural to Filipinos (combining English and Tagalog).
- **Virality Scoring:** AI analyzes drafted content and predicts how "patok" (viral) it will be.
- **Smart Scheduling:** Generates monthly content plans based on industry and brand voice.
- **Image Generation:** Creates high-quality visual prompts and images using Gemini 2.5 Flash Image.
- **Smart Date Selection:** Jump to any date by typing naturally (e.g., "Jan 12 26", "1/2/26", or just "2026"). Includes auto-correction for invalid dates (like clamping Feb 30 to Feb 28).
- **Industry-Specific Trends:** Provides trending topics tailored specifically to your business industry.
- **Admin Dashboard:** Professional overview for platform owners to track MRR, Churn, and User growth.
- **Data Persistence:** Your content plans, drafted posts, and login session are saved automatically via LocalStorage.

## 🚀 Quick Start

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Environment Variable:**
    Create a `.env` file with your Google Gemini API Key:
    ```bash
    VITE_GEMINI_API_KEY="your_google_api_key_here"
    ```

3.  **Run Locally:**
    ```bash
    npm run dev
    ```

## 🔐 Admin Access

To access the platform's administrative features:
- **Direct Login:** Use the credentials below on the standard login page.
- **Shortcut:** Click the small **Lock Icon** in the footer of the landing page.

**Credentials:**
- **Email:** `admin@kawayan.ph`
- **Password:** `admin123`

## 🛠 Technologies

*   **Frontend:** React + TypeScript + Tailwind CSS
*   **Backend:** Node.js (Express) + Better-SQLite3
*   **Database:** Local SQLite (`kawayan.db`) with relational schema and triggers.
*   **AI:** Google GenAI SDK (Gemini 2.5 Flash)
*   **Payments:** Xendit Automated API + Webhook integration
*   **Security:** JWT (JSON Web Tokens) for session management and API protection
*   **Visuals:** Lucide Icons + Recharts
