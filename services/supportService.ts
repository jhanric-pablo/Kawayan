import { Ticket, User } from '../types';

class SupportService {
  private static STORAGE_KEY = 'kawayan_tickets';

  private getTickets(): Ticket[] {
    return JSON.parse(localStorage.getItem(SupportService.STORAGE_KEY) || '[]');
  }

  private saveTickets(tickets: Ticket[]) {
    localStorage.setItem(SupportService.STORAGE_KEY, JSON.stringify(tickets));
  }

  createTicket(user: User, subject: string, priority: string): Ticket {
    const tickets = this.getTickets();
    const newTicket: Ticket = {
      id: Date.now().toString(),
      ticketNum: 1000 + tickets.length + 1,
      userId: user.id,
      userEmail: user.email,
      subject,
      priority: priority as any,
      status: 'Open',
      createdAt: new Date().toISOString(),
      messages: []
    };
    
    tickets.unshift(newTicket);
    this.saveTickets(tickets);
    return newTicket;
  }

  getAllTickets(): Ticket[] {
    return this.getTickets();
  }

  updateTicketStatus(ticketId: string, status: 'Open' | 'Pending' | 'Resolved'): void {
    const tickets = this.getTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
      tickets[index].status = status;
      this.saveTickets(tickets);
    }
  }
}

export const supportService = new SupportService();
