import { Server } from 'socket.io';
import { JWTService } from '../src/services/jwtService.ts';

// Attached to the HTTP server in server.js.
export const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Support hub: tickets and call notices (calls themselves run on Stream).
io.on('connection', (socket) => {
  socket.on('support:join', ({ token }) => {
    if (!token) return;
    const payload = JWTService.verifyToken(token);
    if (!payload) return;

    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    socket.join(`user-${payload.userId}`);

    if (payload.role === 'support' || payload.role === 'admin') {
      socket.join('support-staff');
    }
  });
});

/** Push ticket updates to support staff and the ticket owner instantly */
export const broadcastTicket = (ticket) => {
  io.to('support-staff').emit('ticket:updated', ticket);
  io.to(`user-${ticket.userId}`).emit('ticket:updated', ticket);
};

export const broadcastTicketCreated = (ticket) => {
  io.to('support-staff').emit('ticket:created', ticket);
  io.to(`user-${ticket.userId}`).emit('ticket:updated', ticket);
};

export const broadcastCallsChanged = () => {
  io.to('support-staff').emit('calls:changed');
};

export const broadcastVerificationChanged = (userId) => {
  io.to('support-staff').emit('verification:updated');
  if (userId) io.to(`user-${userId}`).emit('verification:updated');
};
