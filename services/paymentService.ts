export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  type: 'CREDIT' | 'DEBIT';
}

export interface Wallet {
  balance: number;
  currency: string;
  transactions: Transaction[];
  subscription: 'FREE' | 'PRO' | 'ENTERPRISE';
  paymentsTestMode?: boolean;
}

export type TopUpStatus = 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED';

class PaymentService {
  private getAuthHeader() {
    const token = localStorage.getItem('kawayan_jwt');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private getUserId() {
    const session = localStorage.getItem('kawayan_session');
    if (!session) return null;
    return JSON.parse(session).id;
  }

  // Get current state
  async getWalletData(): Promise<Wallet> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch(`/api/wallet/${userId}`, {
      headers: this.getAuthHeader()
    });
    
    if (!response.ok) throw new Error("Failed to fetch wallet");
    return response.json();
  }

  // Sends the browser to PayMongo's hosted checkout; it returns to /?success=true or /?cancelled=true.
  async startTopUp(amount: number): Promise<void> {
    const response = await fetch('/api/wallet/checkout', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ amount }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 503) throw new Error("Online payments aren't switched on for this site yet.");
    if (!response.ok) throw new Error(data.error || 'Could not start the payment.');
    window.location.href = data.checkoutUrl;
  }

  // Credits a paid top-up; safe to call any time.
  async verifyTopUp(): Promise<{ status: TopUpStatus; amount?: number; checkoutUrl?: string }> {
    const response = await fetch('/api/wallet/verify', {
      method: 'POST',
      headers: this.getAuthHeader(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not check the payment.');
    return data;
  }

  async purchaseSubscription(plan: 'PRO' | 'ENTERPRISE', cost: number): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/purchase', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        userId,
        amount: cost,
        description: `Subscription Upgrade: ${plan}`,
        plan
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Purchase failed");
    }

    return true;
  }

  async cancelSubscription(): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/cancel', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ userId })
    });

    return response.ok;
  }

  async makePayment(amount: number, description: string): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/purchase', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        userId,
        amount,
        description
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment failed");
    }

    return true;
  }

  async cancelTransaction(transactionId: string): Promise<Wallet> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/cancel-transaction', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ transactionId })
    });

    if (!response.ok) {
      let errorMessage = "Failed to cancel transaction";
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        // If JSON parse fails, it's likely HTML (404/500)
        const text = await response.text();
        console.error("Non-JSON Error Response:", text);
        errorMessage = `Server Error (${response.status}): The server returned an unexpected response. Please check the console logs.`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

}

export const paymentService = new PaymentService();
