import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, User, MoreHorizontal, Video } from 'lucide-react';

interface Props {
  onEndCall: () => void;
}

const CallOverlay: React.FC<Props> = ({ onEndCall }) => {
  const [status, setStatus] = useState<'dialing' | 'connected'>('dialing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Simulate connection after 2 seconds
    const connectTimer = setTimeout(() => {
      setStatus('connected');
    }, 2000);

    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-slate-800 p-8 rounded-3xl w-80 shadow-2xl border border-slate-700 flex flex-col items-center relative">
        
        <div className="mt-8 mb-8 flex flex-col items-center">
          <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mb-4 relative">
             <User className="w-10 h-10 text-white" />
             {status === 'dialing' && (
               <span className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping"></span>
             )}
          </div>
          <h2 className="text-xl font-bold text-white">Kawayan Support</h2>
          <p className="text-slate-400 mt-1 animate-pulse">
            {status === 'dialing' ? 'Dialing...' : formatTime(duration)}
          </p>
        </div>

        <div className="w-full grid grid-cols-3 gap-4 mb-8">
           <button 
             onClick={() => setIsMuted(!isMuted)}
             className={`flex flex-col items-center gap-2 p-3 rounded-xl transition ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
           >
             {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
             <span className="text-[10px] uppercase font-bold">Mute</span>
           </button>
           <button className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
             <Video className="w-6 h-6"/>
             <span className="text-[10px] uppercase font-bold">Video</span>
           </button>
           <button className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
             <MoreHorizontal className="w-6 h-6"/>
             <span className="text-[10px] uppercase font-bold">More</span>
           </button>
        </div>

        <button 
          onClick={onEndCall}
          className="bg-rose-500 hover:bg-rose-600 text-white rounded-full p-4 shadow-lg shadow-rose-500/30 transition transform hover:scale-110 active:scale-95"
        >
          <PhoneOff className="w-8 h-8" />
        </button>

      </div>
    </div>
  );
};

export default CallOverlay;
