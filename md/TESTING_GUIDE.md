# Testing Guide

[**⬅ Back: Contributing**](./CONTRIBUTING.md) | [**Next: Extension Guide ➔**](./EXTENSION_GUIDE.md)

Kawayan AI uses a mix of unit, integration, and system tests to ensure stability across the React frontend and Node/SQLite backend.

## 1. Test Suite Overview
Tests are located in the `tests/` directory:
-   `basicTest.js`: General sanity checks.
-   `dbTest.ts`: Validates `DatabaseService` operations (CRUD).
-   `systemTest.ts`: End-to-end flow simulations (Login -> Post Generation).

## 2. Running Tests
You can execute tests using the provided shell script or directly via `tsx`.

### **Full Test Suite**
```bash
./test.sh
```

### **Individual Tests**
```bash
npx tsx tests/dbTest.ts
npx tsx tests/systemTest.ts
```

## 3. Testing Environment
-   **Database**: Tests often use a temporary or pre-seeded `kawayan.db`. 
-   **Mocking**: The `geminiService` handles fallbacks, but for testing, ensure your `.env` is configured or use local Ollama mocks.

## 4. Writing New Tests
-   **Database Tests**: Focus on edge cases like insufficient balance, duplicate emails, or invalid post IDs.
-   **Frontend Tests**: (Future) We plan to implement Playwright/Cypress for UI interaction testing.
-   **API Tests**: Test the Express routes in `server.js` using `supertest`.

---

## 5. CI/CD Integration
Ensure all tests pass before submitting a Pull Request. The `test.sh` script is the primary gatekeeper for code quality.
