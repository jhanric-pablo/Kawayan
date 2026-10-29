import { Server } from 'socket.io';
import { JWTService } from '../src/services/jwtService.ts';

// Attached to the HTTP server in server.js.
export const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Signaling Logic
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.data.roomId = roomId; // Track room for disconnect
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('signal', (data) => {
    // data contains: { to: socketId, from: socketId, signal: sdp/ice }
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  socket.on('message', (data) => {
    // data: { roomId, text, sender }
    io.to(data.roomId).emit('message', {
      text: data.text,
      sender: data.sender,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('cam-state', (data) => {
    socket.to(data.roomId).emit('cam-state', data.active);
  });

  socket.on('screen-state', (data) => {
    socket.to(data.roomId).emit('screen-state', data.active);
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-left');
    }
  });

  // Support hub — tickets & calls (real-time, no refresh)
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
