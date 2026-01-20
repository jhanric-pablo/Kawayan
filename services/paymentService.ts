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
}

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

  // Initiate Top-up (Returns Xendit Checkout URL)
  async initiateTopUp(amount: number): Promise<{ checkoutUrl: string, referenceId: string }> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/create-invoice', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        userId,
        amount,
        clientOrigin: window.location.origin // Send the actual browser origin
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create payment invoice");
    }

    const data = await response.json();
    return {
      checkoutUrl: data.checkoutUrl,
      referenceId: data.externalId
    };
  }

  // Confirm Payment (Used after manual verification or webhook)
  async confirmPayment(referenceId: string, amount: number): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        userId,
        amount,
        description: `Wallet Top-up (${referenceId})`
      })
    });

    return response.ok;
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

  async verifyPayment(): Promise<{ status: string, message: string }> {
    const userId = this.getUserId();
    if (!userId) throw new Error("Not authenticated");

    const response = await fetch('/api/wallet/verify-payment', {
      method: 'POST',
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      throw new Error("Failed to verify payment status");
    }

    return response.json();
  }
}

export const paymentService = new PaymentService();
