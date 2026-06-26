import { Ticket, User } from '../types';

class SupportService {
  
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('kawayan_jwt');
    return token ? { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : { 'Content-Type': 'application/json' };
  }

  async createTicket(user: User, subject: string, priority: string, message: string = '', category: Ticket['category'] = 'General'): Promise<Ticket | null> {
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ subject, priority, message, category })
      });
      
      if (!response.ok) throw new Error('Failed to create ticket');
      return await response.json();
    } catch (error) {
      console.error('Error creating ticket:', error);
      return null;
    }
  }

  async getAllTickets(): Promise<Ticket[]> {
    try {
      const response = await fetch('/api/support/tickets', {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error getting tickets:', error);
      return [];
    }
  }

  async updateTicketStatus(ticketId: string, status: 'Open' | 'Pending' | 'Resolved'): Promise<void> {
    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  }
}

export const supportService = new SupportService();
