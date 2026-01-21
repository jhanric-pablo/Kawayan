import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, User, Loader2, Mic, MicOff, Video, VideoOff, Monitor, ScreenShare, ScreenShareOff, MessageSquare, Send, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Props {
  onEndCall: () => void;
  roomId?: string;
  isAgent?: boolean;
  reason?: string;
  targetUserId?: string; 
}

const CallOverlay: React.FC<Props> = ({ onEndCall, roomId, isAgent = false, reason, targetUserId }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<{text: string, sender: string, timestamp: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ]
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    const actualRoomId = roomId || `KawayanSupport-${session.id?.substring(session.id.length - 4) || Math.floor(Math.random() * 10000)}`;
    
    const socket = io(window.location.origin);
    socketRef.current = socket;

    const startCall = async () => {
      try {
        // Start with audio only to keep cam off
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false 
        });
        
        setLocalStream(stream);
        socket.emit('join-room', actualRoomId);

        if (!isAgent) {
          fetch('/api/support/calls/register', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomName: actualRoomId, reason })
          }).catch(e => console.error("Call registration failed", e));
        }

        socket.on('message', (msg) => {
          setMessages(prev => [...prev, msg]);
        });

        socket.on('user-connected', async (userId) => {
          remoteSocketIdRef.current = userId;
          createPeerConnection(userId, stream, true);
        });

        socket.on('signal', async (data) => {
          remoteSocketIdRef.current = data.from;
          if (!pcRef.current) {
            createPeerConnection(data.from, stream, false);
          }
          
          const pc = pcRef.current!;
          if (data.signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { to: data.from, signal: answer });
          } else if (data.signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          } else if (data.signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            } catch (e) { console.error("Error adding ice candidate", e); }
          }
        });

      } catch (err) {
        console.error("Call error:", err);
        alert("Microphone access is required.");
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
    localStream?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    
    const session = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    const token = localStorage.getItem('kawayan_jwt');
    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    await fetch('/api/support/calls/unregister', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ agentId: isAgent ? session.id : null })
    }).catch(() => {});

    const idToResolve = isAgent ? targetUserId : session.id;
    if (idToResolve) {
        await fetch('/api/support/tickets/resolve-user', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ userId: idToResolve })
        }).catch(() => {});
    }
  };

  const createPeerConnection = (targetId: string, stream: MediaStream, isInitiator: boolean) => {
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('disconnected');
      }
    };

    return pc;
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = async () => {
    if (!localStream || !pcRef.current) return;
    
    if (isVideoOff) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, frameRate: 15 } 
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);
        
        // Add to PC
        pcRef.current.addTrack(videoTrack, localStream);
        setIsVideoOff(false);
        // pc.onnegotiationneeded will fire automatically
      } catch (err) { alert("Could not start camera."); }
    } else {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
        
        // Find and remove from PC
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) pcRef.current.removeTrack(sender);
        
        setIsVideoOff(true);
        // pc.onnegotiationneeded will fire automatically
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStream) return;
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Add or Replace
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
        else pcRef.current.addTrack(videoTrack, screenStream);
        
        videoTrack.onended = () => stopScreenShare();
        setIsScreenSharing(true);
      } catch (err) { console.error("Screen share error", err); }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (!pcRef.current || !localStream) return;
    
    const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
    const localVideoTrack = localStream.getVideoTracks()[0];
    
    if (sender) {
      if (localVideoTrack) sender.replaceTrack(localVideoTrack);
      else pcRef.current.removeTrack(sender);
    }

    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;
    const session = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    const actualRoomId = roomId || `KawayanSupport-${session.id?.substring(session.id.length - 4)}`;
    socketRef.current.emit('message', {
      roomId: actualRoomId,
      text: chatInput,
      sender: isAgent ? 'Agent' : 'User'
    });
    setChatInput('');
  };

  const isRemoteVideoActive = remoteStream && remoteStream.getVideoTracks().length > 0;
  const anyoneSharing = isRemoteVideoActive || !isVideoOff || isScreenSharing;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
      <div className="w-full h-full flex flex-col">
        
        <div className="flex-1 flex overflow-hidden">
           
           <div className={`${anyoneSharing ? 'flex-1' : 'w-0'} transition-all duration-500 relative bg-slate-900 flex items-center justify-center border-r border-slate-800/50 overflow-hidden`}>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-contain ${!isRemoteVideoActive ? 'hidden' : 'block'}`} 
              />

              {(!isRemoteVideoActive || status !== 'connected') && status === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-slate-900">
                   <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-emerald-500/20">
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                   </div>
                   <h2 className="text-2xl font-black text-white tracking-tight">Connecting Bridge...</h2>
                   <p className="text-slate-500 mt-2 text-sm italic">"{reason || 'Securing communication line...'}"</p>
                </div>
              )}

              <div className={`absolute bottom-8 right-8 transition-all duration-500 ${isVideoOff && !isScreenSharing ? 'w-0 h-0 opacity-0' : 'w-56 h-40 border-emerald-500/50 opacity-100'} bg-black rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl z-30`}>
                 <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1]`} />
                 <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded text-[8px] text-white font-black uppercase tracking-tighter border border-white/10">You</div>
              </div>
           </div>

           <div className={`flex-1 bg-slate-950 flex flex-col border-l border-slate-800 shadow-2xl transition-all duration-500`}>
              {!anyoneSharing && (
                <div className="p-8 pb-0 animate-in fade-in duration-1000 text-center">
                   <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500 shadow-lg">
                      <User className="w-10 h-10 text-slate-400" />
                   </div>
                   <h3 className="text-lg font-bold text-white uppercase tracking-widest">{isAgent ? 'User' : 'Support Agent'} Connected</h3>
                   <p className="text-xs text-emerald-500 font-black uppercase mt-1">Audio Only Mode</p>
                </div>
              )}

              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                 <div>
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <MessageSquare className="w-4 h-4"/> Live Support Chat
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">Encrypted P2P Session</p>
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
                      <p className="text-xs uppercase font-black tracking-widest">Type to communicate</p>
                   </div>
                 )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-800 bg-slate-900/30 flex gap-3">
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

        <div className="bg-slate-950/90 backdrop-blur-xl p-8 flex justify-center items-center gap-6 border-t border-slate-800/50 shrink-0">
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
           </div>
           <div className="h-10 w-px bg-slate-800 mx-4" />
           <button onClick={onEndCall} className="px-10 py-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition shadow-xl flex items-center gap-3 font-black uppercase tracking-widest text-sm transform active:scale-95">
             <PhoneOff className="w-5 h-5" /> <span>End Session</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;