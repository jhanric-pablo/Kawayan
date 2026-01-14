export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  type: 'CREDIT' | 'DEBIT';
}

export interface Wallet {
  balance: number;
  currency: string;
  transactions: Transaction[];
  subscription: 'FREE' | 'PRO' | 'ENTERPRISE';
}

class PaymentService {
  private static STORAGE_KEY = 'kawayan_wallet';

  private getWallet(): Wallet {
    const defaultWallet: Wallet = {
      balance: 0,
      currency: 'PHP',
      transactions: [],
      subscription: 'FREE'
    };
    return JSON.parse(localStorage.getItem(PaymentService.STORAGE_KEY) || JSON.stringify(defaultWallet));
  }

  private saveWallet(wallet: Wallet) {
    localStorage.setItem(PaymentService.STORAGE_KEY, JSON.stringify(wallet));
  }

  // Get current state
  async getWalletData(): Promise<Wallet> {
    // Simulate API fetch
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.getWallet();
  }

  // Simulate Xendit Payment Intent
  async initiateTopUp(amount: number, method: 'GCASH' | 'MAYA' | 'CARD'): Promise<{ checkoutUrl: string, referenceId: string }> {
    console.log(`Creating Xendit Invoice for ${amount}...`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Network delay

    const referenceId = `txn_${Date.now()}`;
    // In a real app, this returns a redirect URL to Xendit
    return {
      checkoutUrl: `https://checkout.xendit.co/web/${referenceId}`, 
      referenceId
    };
  }

  // Confirm Payment (Simulates Webhook)
  async confirmPayment(referenceId: string, amount: number): Promise<boolean> {
    const wallet = this.getWallet();
    
    // Add Transaction
    const newTxn: Transaction = {
      id: referenceId,
      date: new Date().toISOString(),
      description: 'Wallet Top-up',
      amount: amount,
      status: 'COMPLETED',
      type: 'CREDIT'
    };

    wallet.transactions.unshift(newTxn);
    wallet.balance += amount;
    
    this.saveWallet(wallet);
    return true;
  }

  async purchaseSubscription(plan: 'PRO' | 'ENTERPRISE', cost: number): Promise<boolean> {
    const wallet = this.getWallet();

    if (wallet.balance < cost) {
      throw new Error("Insufficient Balance");
    }

    wallet.balance -= cost;
    wallet.subscription = plan;
    wallet.transactions.unshift({
      id: `sub_${Date.now()}`,
      date: new Date().toISOString(),
      description: `Subscription Upgrade: ${plan}`,
      amount: cost,
      status: 'COMPLETED',
      type: 'DEBIT'
    });

    this.saveWallet(wallet);
    return true;
  }

  async cancelSubscription(): Promise<boolean> {
    const wallet = this.getWallet();
    if (wallet.subscription === 'FREE') return false;

    const previousPlan = wallet.subscription;
    wallet.subscription = 'FREE';
    
    // Log the cancellation
    wallet.transactions.unshift({
      id: `cancel_${Date.now()}`,
      date: new Date().toISOString(),
      description: `Subscription Cancelled: ${previousPlan}`,
      amount: 0,
      status: 'COMPLETED',
      type: 'DEBIT' // Informational
    });

    this.saveWallet(wallet);
    return true;
  }
}

export const paymentService = new PaymentService();
