# Kawayan AI - Payment Setup Guide (Xendit Automated)

[**⬅ Back: Social Auth**](./SOCIAL_AUTH.md)

The system is now integrated with **Xendit** for fully automated payments.

## 1. How it works (Automated)

```mermaid
flowchart LR
    A[User Inputs Amount] --> B[Backend calls Xendit API]
    B --> C[Xendit returns Invoice URL]
    C --> D[User redirected to Xendit Page]
    D --> E{Payment Success?}
    E -- Yes --> F[Xendit sends Webhook]
    F --> G[Backend verifies & updates Balance]
    G --> H[User Wallet reflects Credits]
    E -- No --> I[Invoice Expires/Cancelled]
```

1.  **User Side:** The user enters an amount in the Billing dashboard.
2.  **Invoice Creation:** The backend calls Xendit API to create a unique invoice.
3.  **Redirect:** The user is redirected to Xendit's secure checkout page (supports GCash, Maya, QRIS, Cards).
4.  **Transaction Record:** A `PENDING` transaction is recorded in the database immediately.
5.  **Webhook:** Once the user pays, Xendit sends a webhook to `/api/webhooks/xendit`.
6.  **Automation:** The system verifies the webhook token, identifies the transaction, approves it, and updates the user's balance instantly.

## 2. Configuration

Current credentials in `.env`:
- `XENDIT_SECRET_KEY`: Used for API calls (Basic Auth).
- `XENDIT_WEBHOOK_VERIFICATION_TOKEN`: Used to verify incoming webhooks from Xendit.

### Webhook URL
Ensure your Xendit Dashboard is configured with the following Callback URL for **Invoices**:
`https://your-domain.com/api/webhooks/xendit`

---

## 3. Manual Fallback

Even with automation, you can still manually approve a transaction if needed:

```bash
curl -X POST http://localhost:3001/api/admin/wallet/approve \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "txn_..."}'
```
