import { io, Socket } from 'socket.io-client';
import { Ticket } from '../types';

type TicketHandler = (ticket: Ticket) => void;
type VoidHandler = () => void;

/**
 * Singleton Socket.io client for support ticket & call real-time sync.
 * Connect once per logged-in session; components subscribe to events.
 */
class SupportRealtimeService {
  private socket: Socket | null = null;
  private ticketCreatedHandlers = new Set<TicketHandler>();
  private ticketUpdatedHandlers = new Set<TicketHandler>();
  private callsChangedHandlers = new Set<VoidHandler>();

  connect(): void {
    const token = localStorage.getItem('kawayan_jwt');
    if (!token) return;

    if (!this.socket) {
      this.socket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      this.socket.on('ticket:created', (ticket: Ticket) => {
        this.ticketCreatedHandlers.forEach((fn) => fn(ticket));
      });

      this.socket.on('ticket:updated', (ticket: Ticket) => {
        this.ticketUpdatedHandlers.forEach((fn) => fn(ticket));
      });

      this.socket.on('calls:changed', () => {
        this.callsChangedHandlers.forEach((fn) => fn());
      });

      this.socket.on('connect', () => {
        const jwt = localStorage.getItem('kawayan_jwt');
        if (jwt) this.socket?.emit('support:join', { token: jwt });
      });
    }

    if (this.socket.connected) {
      this.socket.emit('support:join', { token });
    } else if (!this.socket.active) {
      this.socket.connect();
    }
  }

  onTicketCreated(handler: TicketHandler): () => void {
    this.ticketCreatedHandlers.add(handler);
    return () => this.ticketCreatedHandlers.delete(handler);
  }

  onTicketUpdated(handler: TicketHandler): () => void {
    this.ticketUpdatedHandlers.add(handler);
    return () => this.ticketUpdatedHandlers.delete(handler);
  }

  onCallsChanged(handler: VoidHandler): () => void {
    this.callsChangedHandlers.add(handler);
    return () => this.callsChangedHandlers.delete(handler);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.ticketCreatedHandlers.clear();
    this.ticketUpdatedHandlers.clear();
    this.callsChangedHandlers.clear();
  }
}

export const supportRealtime = new SupportRealtimeService();
