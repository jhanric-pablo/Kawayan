# Kawayan AI - Developer Guide

This guide is intended for developers who want to contribute to or maintain the Kawayan AI codebase.

## 1. Development Environment Setup

### Prerequisites
- **Node.js:** v18 or higher.
- **SQLite:** Pre-installed on most systems (the `better-sqlite3` driver handles the interaction).

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` (use `.env.example` as a template).

### Running the App
The project uses `concurrently` to run both the frontend and backend in one command:
```bash
npm run dev:full
```
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3001

---

## 2. Project Structure

- `backend/`: Legacy PHP API (Reference only).
- `components/`: React UI components (Tailwind styled).
- `config/`: Database and environment configuration.
- `services/`: Frontend-to-Backend / Frontend-to-AI logic.
- `tests/`: System and unit tests.
- `utils/`: Logging and helper utilities.
- `server.js`: The main Express server file.

---

## 3. Coding Standards

- **TypeScript:** Use strict typing. Avoid `any` whenever possible.
- **Styling:** Use Tailwind CSS utility classes. Prefer CSS variables for theme-specific colors.
- **Database:** Always use placeholders (`?`) in SQL queries to prevent SQL injection.
- **AI Prompts:** When modifying `geminiService.ts`, always test prompts in the [AI Studio](https://aistudio.google.com/) first.

---

## 4. Testing

### Database Tests
Test the SQLite schema and relational integrity:
```bash
npm run test:db
```

### System Tests
Run the comprehensive integration test suite:
```bash
npm run test
```

---

## 5. Deployment

When deploying to a VPS (like DigitalOcean or AWS):
1. Set `NODE_ENV=production` in `.env`.
2. Build the frontend: `npm run build`.
3. Serve the `dist/` folder using Nginx or the Express server.
4. Use a process manager like `pm2` to keep `server.js` running.
