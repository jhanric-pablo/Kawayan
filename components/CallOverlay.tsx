import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, User, Loader2, Mic, MicOff, Video, VideoOff, Monitor, ScreenShare, ScreenShareOff, MessageSquare, Send, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useOrganicDialog } from './OrganicDialog';

interface Props {
  onEndCall: () => void;
  roomId?: string;
  isAgent?: boolean;
  reason?: string;
  targetUserId?: string; 
}

const CallOverlay: React.FC<Props> = ({ onEndCall, roomId, isAgent = false, reason, targetUserId }) => {
  const dialog = useOrganicDialog();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Local Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Remote UI States (Signaled via Socket)
  const [remoteCamActive, setRemoteCamActive] = useState(false);
  const [remoteScreenActive, setRemoteScreenActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // Local UI States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<{text: string, sender: string, timestamp: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null); // NEW: Local screen preview
  const remoteCamVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenVideoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ]
  };

  const actualRoomId = useRef<string>('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  // Handle Local Stream Views
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff]);

  useEffect(() => {
    if (localScreenVideoRef.current && screenStreamRef.current && isScreenSharing) {
      localScreenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  // Handle Remote Stream Views
  useEffect(() => {
    if (remoteStream) {
      if (remoteCamVideoRef.current && remoteCamActive) {
        remoteCamVideoRef.current.srcObject = remoteStream;
      }
      if (remoteScreenVideoRef.current && remoteScreenActive) {
        remoteScreenVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, remoteCamActive, remoteScreenActive]);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    actualRoomId.current = roomId || `KawayanSupport-${session.id?.substring(session.id.length - 4) || Math.floor(Math.random() * 10000)}`;
    
    const socket = io(window.location.origin);
    socketRef.current = socket;

    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false 
        });
        
        setLocalStream(stream);
        socket.emit('join-room', actualRoomId.current);

        if (!isAgent) {
          fetch('/api/support/calls/register', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomName: actualRoomId.current, reason })
          }).catch(e => console.error("Call registration failed", e));
        }

        socket.on('message', (msg) => setMessages(prev => [...prev, msg]));
        socket.on('cam-state', (active) => setRemoteCamActive(active));
        socket.on('screen-state', (active) => setRemoteScreenActive(active));
        socket.on('peer-left', () => onEndCall());

        socket.on('user-connected', (userId) => {
          const pc = createPeerConnection(userId, stream);
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.emit('signal', { to: userId, signal: offer });
          });
        });

        socket.on('signal', async (data) => {
          if (!pcRef.current) createPeerConnection(data.from, stream);
          const pc = pcRef.current!;
          
          if (data.signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { to: data.from, signal: answer });
          } else if (data.signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          } else if (data.signal.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate)); } catch (e) {}
          }
        });

      } catch (err) {
        console.error("Call error:", err);
        void dialog.alert("Microphone access is required.");
        onEndCall();
      }
    };

    startCall();

    return () => {
      handleCallEndCleanup();
    };
  }, []);

  const handleCallEndCleanup = async () => {
    socketRef.current?.disconnect();
    localStream?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    screenStreamRef.current?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    pcRef.current?.close();
    
    const session = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    const token = localStorage.getItem('kawayan_jwt');
    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    fetch('/api/support/calls/unregister', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ agentId: isAgent ? session.id : null })
    }).catch(() => {});

    const idToResolve = isAgent ? targetUserId : session.id;
    if (idToResolve) {
        fetch('/api/support/tickets/resolve-user', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ userId: idToResolve })
        }).catch(() => {});
    }
  };

  const createPeerConnection = (targetId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', { to: targetId, signal: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setStatus('connected');
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', { to: targetId, signal: offer });
      } catch (e) { console.error("Negotiation error", e); }
    };

    return pc;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (!localStream || !pcRef.current) return;
    
    if (isVideoOff) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const track = camStream.getVideoTracks()[0];
        localStream.addTrack(track);
        pcRef.current.addTrack(track, localStream);
        setIsVideoOff(false);
        socketRef.current?.emit('cam-state', { roomId: actualRoomId.current, active: true });
      } catch (e) { void dialog.alert("Camera access denied."); }
    } else {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.stop();
        localStream.removeTrack(track);
        const sender = pcRef.current.getSenders().find(s => s.track === track);
        if (sender) pcRef.current.removeTrack(sender);
        setIsVideoOff(true);
        socketRef.current?.emit('cam-state', { roomId: actualRoomId.current, active: false });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStream) return;
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const track = screenStream.getVideoTracks()[0];
        pcRef.current.addTrack(track, screenStream);
        track.onended = () => stopScreenShare();
        setIsScreenSharing(true);
        socketRef.current?.emit('screen-state', { roomId: actualRoomId.current, active: true });
      } catch (e) {}
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (!pcRef.current || !screenStreamRef.current) return;
    const track = screenStreamRef.current.getVideoTracks()[0];
    const sender = pcRef.current.getSenders().find(s => s.track === track);
    if (sender) pcRef.current.removeTrack(sender);
    track.stop();
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    socketRef.current?.emit('screen-state', { roomId: actualRoomId.current, active: false });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('message', {
      roomId: actualRoomId.current,
      text: chatInput,
      sender: isAgent ? 'Agent' : 'User'
    });
    setChatInput('');
  };

  const anyoneSharing = remoteCamActive || remoteScreenActive || !isVideoOff || isScreenSharing;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden font-sans">
      <div className="w-full h-full flex flex-col">
        
        <div className="flex-1 flex overflow-hidden">
           
           {/* Video / Content Area */}
           <div className={`${anyoneSharing ? 'flex-[2.5]' : 'w-0'} transition-all duration-500 relative bg-slate-900 flex flex-col border-r border-slate-800/50 overflow-hidden`}>
              
              {/* Remote Screen Share (BIG) */}
              <div className={`flex-1 relative ${!remoteScreenActive && 'hidden'}`}>
                 <video ref={remoteScreenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                 <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-white/10">Peer Screen</div>
              </div>

              {/* Remote Camera - Centered if no screen, else floating small */}
              <div className={`${remoteCamActive ? 'flex' : 'hidden'} ${remoteScreenActive ? 'absolute bottom-8 right-8 w-64 h-48 border-2 border-slate-700 shadow-2xl rounded-3xl overflow-hidden z-40' : 'flex-1'} transition-all duration-500 bg-black items-center justify-center`}>
                 <video ref={remoteCamVideoRef} autoPlay playsInline className={`w-full h-full ${remoteScreenActive ? 'object-cover' : 'object-contain'}`} />
                 <div className="absolute top-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[8px] text-white font-black uppercase tracking-tighter border border-white/10 z-50">{isAgent ? 'User' : 'Agent'}</div>
              </div>

              {/* Status Message (Waiting) */}
              {!remoteScreenActive && !remoteCamActive && status === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-slate-900">
                   <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mb-6 mx-auto" />
                   <h2 className="text-2xl font-black text-white tracking-tight">Connecting Bridge...</h2>
                   <p className="text-slate-500 mt-2 text-sm italic">"{reason || 'Securing communication line...'}"</p>
                </div>
              )}

              {/* Local Mini-Preview (Camera) */}
              <div className={`absolute bottom-8 left-8 transition-all duration-500 ${isVideoOff ? 'w-0 h-0 opacity-0' : 'w-48 h-32 border-2 border-emerald-500 shadow-2xl z-50'} bg-black rounded-3xl overflow-hidden`}>
                 <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                 <div className="absolute bottom-2 left-2 bg-emerald-600 px-2 py-0.5 rounded text-[8px] text-white font-black uppercase tracking-tighter border border-white/10">Your Camera</div>
              </div>

              {/* NEW: Local Screen Share Preview */}
              <div className={`absolute top-8 left-8 transition-all duration-500 ${!isScreenSharing ? 'w-0 h-0 opacity-0' : 'w-64 h-40 border-2 border-blue-500 shadow-2xl z-50'} bg-black rounded-3xl overflow-hidden`}>
                 <video ref={localScreenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
                 <div className="absolute bottom-2 left-2 bg-blue-600 px-2 py-0.5 rounded text-[8px] text-white font-black uppercase tracking-tighter border border-white/10">Your Screen</div>
              </div>
           </div>

           {/* Chat Area - Becomes primary when cams off */}
           <div className={`flex-1 bg-slate-950 flex flex-col border-l border-slate-800 shadow-2xl transition-all duration-500`}>
              {!anyoneSharing && (
                <div className="p-12 pb-4 animate-in fade-in duration-1000 text-center">
                   <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500 shadow-lg relative">
                      <User className="w-12 h-12 text-slate-400" />
                      <div className="absolute -bottom-2 bg-emerald-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Connected</div>
                   </div>
                   <h3 className="text-xl font-bold text-white uppercase tracking-widest">{isAgent ? 'User' : 'Support Agent'} Online</h3>
                   <p className="text-xs text-emerald-500 font-black uppercase mt-1 tracking-widest opacity-80 italic">Secure Audio Bridge Enabled</p>
                </div>
              )}

              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                 <div>
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <MessageSquare className="w-4 h-4"/> Support Chat
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">P2P Encrypted Session</p>
                 </div>
                 {anyoneSharing && <button onClick={() => setShowChat(!showChat)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X className="w-4 h-4"/></button>}
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                 {messages.map((msg, idx) => (
                   <div key={idx} className={`flex flex-col ${msg.sender === (isAgent ? 'Agent' : 'User') ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] shadow-lg ${
                         msg.sender === (isAgent ? 'Agent' : 'User') 
                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      }`}>
                         {msg.text}
                      </div>
                      <span className="text-[8px] font-black text-slate-600 uppercase mt-2 tracking-widest">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
                 ))}
                 {messages.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                      <MessageSquare className="w-16 h-16 mb-4"/>
                      <p className="text-xs uppercase font-black tracking-widest">Start chatting below</p>
                   </div>
                 )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-800 bg-slate-900/30 flex gap-3 shrink-0">
                 <input 
                   type="text" 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Type a message..."
                   className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                 />
                 <button type="submit" disabled={!chatInput.trim()} className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition shadow-xl transform active:scale-95">
                    <Send className="w-5 h-5"/>
                 </button>
              </form>
           </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-slate-950/95 backdrop-blur-2xl p-8 flex justify-center items-center gap-6 border-t border-slate-800/50 shrink-0">
           <div className="flex gap-3">
              <button onClick={toggleMute} className={`w-14 h-14 rounded-2xl transition flex items-center justify-center ${isMuted ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
              </button>
              <button onClick={toggleVideo} className={`w-14 h-14 rounded-2xl transition flex items-center justify-center ${isVideoOff ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
              </button>
              <button onClick={toggleScreenShare} className={`w-14 h-14 rounded-2xl transition flex items-center justify-center ${isScreenSharing ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {isScreenSharing ? <ScreenShareOff className="w-6 h-6"/> : <Monitor className="w-6 h-6"/>}
              </button>
              {!showChat && (
                <button onClick={() => setShowChat(true)} className="w-14 h-14 rounded-2xl transition flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-slate-700">
                  <MessageSquare className="w-6 h-6"/>
                </button>
              )}
           </div>
           
           <div className="h-10 w-px bg-slate-800 mx-4" />
           
           <button onClick={onEndCall} className="px-10 py-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition shadow-xl shadow-rose-600/20 flex items-center gap-3 font-black uppercase tracking-widest text-sm transform active:scale-95">
             <PhoneOff className="w-5 h-5" /> <span>End Session</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
