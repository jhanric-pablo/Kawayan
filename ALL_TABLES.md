# Kawayan AI - Complete Database Schema

This document contains the definitions for all "tables" (entities) used in the Kawayan AI system.

## 1. User Table
Stores account credentials and role access.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Primary Key. Unique user identifier. |
| `email` | `string` | User's login email. Unique. |
| `passwordHash` | `string` | Encrypted password string. |
| `role` | `enum` | Access level: `'user'`, `'admin'`, or `'support'`. |
| `businessName` | `string` | (Optional) Name of the user's SME. |

---

## 2. BrandProfile Table
Stores the brand identity used for AI context. Linked 1:1 with User.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Primary Key. |
| `userId` | `string` | Foreign Key -> User.id. |
| `businessName` | `string` | Display name for posts. |
| `industry` | `string` | e.g., "Cafe", "Retail". |
| `targetAudience` | `string` | Description of customer base. |
| `brandVoice` | `string` | e.g., "Professional", "Friendly". |
| `keyThemes` | `string` | Comma-separated content pillars. |
| `brandColors` | `string[]` | JSON Array of Hex codes (e.g., `['#FFFFFF']`). |
| `contactEmail` | `string` | Public contact email. |
| `contactPhone` | `string` | Public contact number. |

---

## 3. GeneratedPost Table
Stores content created by the AI.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Primary Key. |
| `userId` | `string` | Foreign Key -> User.id. |
| `date` | `string` | Scheduled publication date (ISO Date). |
| `topic` | `string` | The content topic/idea. |
| `caption` | `string` | Generated Taglish caption. |
| `imagePrompt` | `string` | Prompt sent to image generation AI. |
| `imageUrl` | `string` | (Optional) Base64 string of the image. |
| `status` | `enum` | `'Draft'`, `'Scheduled'`, `'Published'`. |
| `viralityScore` | `number` | Score 0-100. |
| `viralityReason` | `string` | AI explanation for the score. |
| `format` | `string` | e.g., "Image", "Video". |
| `regenCount` | `number` | Number of times regenerated (Max 2). |
| `history` | `json` | Array of previous `PostVersion` objects. |

---

## 4. Wallet Table (`wallets`)
Manages financial credits and subscription state.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `user_id` | `TEXT` | Primary Key. Foreign Key -> User.id. |
| `balance` | `REAL` | Current prepaid balance in PHP. |
| `currency` | `TEXT` | Default 'PHP'. |
| `subscription` | `TEXT` | `'FREE'`, `'PRO'`, `'ENTERPRISE'`. |
| `updated_at` | `DATETIME` | Automatic timestamp. |

---

## 5. Transaction Table (`transactions`)
Records financial movements.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key. Transaction Reference ID. |
| `user_id` | `TEXT` | Foreign Key -> wallets.user_id. |
| `date` | `DATETIME` | ISO Timestamp (Default: CURRENT_TIMESTAMP). |
| `description` | `TEXT` | Transaction label. |
| `amount` | `REAL` | Value in PHP. |
| `status` | `TEXT` | `'PENDING'`, `'COMPLETED'`, `'FAILED'`. |
| `type` | `TEXT` | `'CREDIT'` (Deposit), `'DEBIT'` (Payment). |

---

## 6. Ticket Table
Stores support requests.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Primary Key. |
| `ticketNum` | `number` | Sequential Ticket ID (e.g., 1001). |
| `userId` | `string` | Foreign Key -> User.id. |
| `userEmail` | `string` | User's contact email. |
| `subject` | `string` | Issue summary. |
| `priority` | `enum` | `'Low'`, `'Medium'`, `'High'`, `'Critical'`. |
| `status` | `enum` | `'Open'`, `'Pending'`, `'Resolved'`. |
| `createdAt` | `string` | ISO Timestamp. |
| `messages` | `json` | Array of chat messages. |

---

## 7. SocialPlatformData Table
Stores connection status and analytical data.

| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `platform` | `enum` | `'facebook'`, `'instagram'`, `'tiktok'`. |
| `connected` | `boolean` | Connection state. |
| `token` | `string` | (Mock) OAuth Access Token. |
| `connectedAt` | `string` | ISO Timestamp. |
| `followers` | `number` | Cached follower count. |
| `engagement` | `number` | Cached engagement rate. |
| `reach` | `json` | Time-series array of reach metrics. |
