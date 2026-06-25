import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { ArrowRight, Sparkles, TrendingUp, Calendar, Zap, CheckCircle2, Play } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
}

const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Smooth Scroll & Scrub Refs
  const targetScrollY = useRef(0);
  const currentScrollY = useRef(0);
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // --- Optimized Liquid Scroll & Scrub Logic ---
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const handleScroll = () => {
      targetScrollY.current = window.scrollY;
    };

    const smoothUpdate = (time: number) => {
      // 1. Liquid-Smooth Scroll (Responsive Damping)
      const scrollEasing = 0.08; 
      currentScrollY.current += (targetScrollY.current - currentScrollY.current) * scrollEasing;
      
      const containerTop = container.offsetTop;
      const scrollRange = window.innerHeight * 2; // More responsive range
      const progress = Math.min(1, Math.max(0, (currentScrollY.current - containerTop) / scrollRange));

      // 2. Performance Hack: Direct DOM Manipulation
      // Balanced easing for responsiveness + smoothness
      const easedProgress = progress * (2 - progress); 
      const opacity = Math.max(0, 1 - (easedProgress * 1.5)); 
      const scale = 1 - (easedProgress * 0.05);
      
      if (contentRef.current) {
        contentRef.current.style.opacity = opacity.toString();
        contentRef.current.style.transform = `translate3d(${mousePos.x * -15}px, ${mousePos.y * -15}px, 0) scale(${scale})`;
        contentRef.current.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
      }
      
      if (overlayRef.current) {
        overlayRef.current.style.opacity = (0.7 + (1 - opacity) * 0.3).toString();
      }

      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = (1 - (progress * 4)).toString();
      }

      // 3. Liquid Video Tracking
      if (video.duration) {
        targetTimeRef.current = video.duration * progress;
      }

      const videoEasing = 0.12; // Snappier video tracking
      currentTimeRef.current += (targetTimeRef.current - currentTimeRef.current) * videoEasing;

      if (video && !isNaN(video.duration)) {
        const diff = Math.abs(video.currentTime - currentTimeRef.current);
        // Ultra-high precision for "more frames" feel
        if (!video.seeking && diff > 0.0005) {
          video.currentTime = currentTimeRef.current;
        }
      }

      requestRef.current = requestAnimationFrame(smoothUpdate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    requestRef.current = requestAnimationFrame(smoothUpdate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(requestRef.current);
    };
  }, [videoLoaded, mousePos.x, mousePos.y]);

  // --- Parallax Logic ---
  const handleParallaxMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    setMousePos({
      x: (clientX - centerX) / centerX,
      y: (clientY - centerY) / centerY
    });
  };

  return (
    <div 
      className="flex flex-col relative bg-slate-50 dark:bg-[#273338] transition-colors overflow-x-hidden"
      onMouseMove={handleParallaxMove}
    >
      
      {/* Hero Section with Scroll Scrubbing Video */}
      <div ref={containerRef} className="relative bg-slate-900 z-0">
        <section 
          className="sticky top-0 h-screen w-full flex items-center overflow-hidden z-10 transform-gpu"
          style={{ willChange: 'transform' }}
        >
          
          {/* Background Video with Hardware Acceleration */}
          <video
            ref={videoRef}
            src="/video/video.mp4"
            onLoadedMetadata={() => setVideoLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover -z-20 pointer-events-none transform-gpu"
            style={{ 
              willChange: 'transform',
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translate3d(0,0,0) scale(1.02)'
            }}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
          />

          {/* Overlay Darkening with Progressive Fade */}
          <div 
            ref={overlayRef}
            className="absolute inset-0 bg-black/70 dark:bg-black/85 -z-10 transition-opacity duration-700"
          ></div>

          {/* Bottom Fade Transition */}
          <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-slate-50 dark:from-slate-900 to-transparent z-20"></div>

          {/* Scroll Indicator */}
          <div 
            ref={indicatorRef}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/40 animate-bounce transition-opacity duration-500"
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.25em]">Scroll to Advance</span>
            <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, #2B5748, transparent)' }}></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Text */}
              <div 
                ref={contentRef}
                className="text-center lg:text-left transition-transform duration-100 ease-out z-20"
              >
                <h1 
                  className="font-display text-6xl sm:text-7xl lg:text-8xl text-white tracking-tight mb-8 leading-[0.95]"
                  style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.85))' }}
                >
                  Social Media <br /> 
                  <span className="text-gradient-accent" style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #2B5748, #2B5748)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                    On Autopilot.
                  </span>
                </h1>
                
                <p 
                  className="text-xl text-white max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed font-bold"
                  style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))' }}
                >
                  Kawayan AI uses advanced local LLMs to generate viral "Taglish" captions, trendy visuals, and schedules for Philippine MSMEs.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <button 
                    onClick={() => onNavigate(ViewState.SIGNUP)}
                    className="group/btn relative px-8 py-4 rounded-full font-bold text-base overflow-hidden w-full sm:w-auto hover:scale-105 active:scale-95 transition-all duration-300 shadow-accent"
                    style={{ background: "#2B5748", color: '#FFFFFF' }}
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      Start Free Trial <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => onNavigate(ViewState.DEMO)}
                    className="px-8 py-4 bg-white/10 border border-white/25 text-white rounded-full font-bold text-base transition-all flex items-center justify-center gap-2 w-full sm:w-auto hover:bg-white/20 backdrop-blur-sm"
                  >
                    <Play className="w-5 h-5 fill-current" /> Watch Demo
                  </button>
                </div>
              </div>

              {/* Right Column: Floating Cards (Parallax) */}
              <div className="relative h-[600px] hidden lg:block perspective-1000">
                
                {/* Card 1: Main Visual */}
                <div 
                  className="absolute top-10 right-10 w-80 bg-white rounded-3xl p-4 z-20 animate-float"
                  style={{ 
                    transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px) rotateY(-10deg)`,
                    transition: 'transform 0.1s ease-out',
                    boxShadow: '0 24px 60px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="h-48 rounded-2xl mb-4 overflow-hidden relative" style={{ background: '#273338' }}>
                     <div className="absolute inset-0 dot-pattern-dark opacity-60"></div>
                     <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(57,231,60,0.25), transparent 60%)' }}></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 animate-pulse" style={{ color: '#2B5748' }}/>
                     </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 bg-slate-100 rounded-full animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-slate-100 rounded-full animate-pulse"></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "#2B5748" }}>AI</div>
                     <span>Generating content...</span>
                     <span className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "#2B5748" }}></span>
                  </div>
                </div>

                {/* Card 2: Stats (Glassmorphism) */}
                <div 
                  className="absolute bottom-20 left-10 w-64 glass-card p-6 rounded-3xl z-30 backdrop-blur-xl"
                  style={{ 
                    transform: `translate(${mousePos.x * 50}px, ${mousePos.y * 50}px) rotateY(10deg)`,
                    transition: 'transform 0.15s ease-out',
                    boxShadow: '0 16px 40px -8px rgba(0,0,0,0.25)'
                  }}
                >
                   <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-xl bg-[#2B5748]/10">
                        <TrendingUp className="w-4 h-4" style={{ color: '#2B5748' }}/>
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Virality Score</span>
                   </div>
                   <div className="text-4xl font-display text-slate-800 mb-2">98%</div>
                   <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full w-[98%]" style={{ background: "#2B5748" }}></div>
                   </div>
                </div>

                {/* Card 3: Accent Cube */}
                <div 
                   className="absolute top-1/2 left-1/2 w-20 h-20 rounded-2xl z-10 flex items-center justify-center rotate-12 shadow-accent"
                   style={{ 
                    background: '#2B5748',
                    transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px) translate(-50%, -50%) rotate(12deg)`,
                    transition: 'transform 0.2s ease-out'
                  }}
                >
                   <Zap className="w-9 h-9 fill-current text-white" />
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* Marquee Section */}
      <div className="w-full bg-white dark:bg-[#2B5748]/40 border-y border-[#273338]/10 dark:border-[#9CB080]/20 py-6 overflow-hidden relative z-10">
         <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10"></div>
         <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10"></div>
         <p className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300 dark:text-slate-600 z-20 pointer-events-none">Trusted by</p>
         
         <div className="flex w-[200%] animate-scroll">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex justify-around w-1/2 items-center gap-16 px-16 min-w-max">
                 <span className="text-xl font-black text-slate-200 dark:text-slate-700 tracking-tight">KAIN<span style={{ color: '#2B5748' }}>.</span>PO</span>
                 <span className="text-xl font-light italic text-slate-200 dark:text-slate-700">ManilaStrut</span>
                 <span className="text-xl font-bold tracking-[0.2em] text-slate-200 dark:text-slate-700">BARAKO</span>
                 <span className="text-xl font-mono text-slate-200 dark:text-slate-700">TechTito</span>
                 <span className="text-xl font-semibold text-slate-200 dark:text-slate-700">Lola's<span className="font-light">Best</span></span>
                 <span className="text-xl font-black text-slate-200 dark:text-slate-700" style={{ letterSpacing: '0.08em' }}>DISKARTE<span style={{ color: '#2B5748' }}>!</span></span>
              </div>
            ))}
         </div>
      </div>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 relative z-10 bg-[#FFFFFF] dark:bg-[#273338]">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
               <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2B5748] bg-[#2B5748]/10 text-xs font-mono font-bold uppercase tracking-[0.15em] text-[#2B5748] mb-5">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#2B5748] animate-pulse-dot inline-block"></span>
                 Built for Filipino MSMEs
               </span>
               <h2 className="font-display text-5xl text-slate-900 dark:text-white mb-5 leading-tight">Master the Algorithm.</h2>
               <p className="text-lg text-slate-500 dark:text-slate-400">Native Filipino AI understanding. No more robotic translations.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-5 h-auto md:h-[620px]">
               
               {/* Feature 1: Large Left */}
               <div className="md:col-span-2 row-span-2 bg-white dark:bg-[#2B5748]/40 rounded-[2rem] p-8 border border-[#2B5748] dark:border-[#9CB080]/20 shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                  {/* Ambient glow */}
                  <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl -mr-20 -mt-20 opacity-30 group-hover:opacity-50 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, #2B5748, transparent)' }}></div>
                  <div className="relative z-10 h-full flex flex-col justify-between">
                     <div>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-900 mb-6 shadow-accent-sm" style={{ background: "#2B5748" }}>
                           <Sparkles className="w-6 h-6 text-white"/>
                        </div>
                        <h3 className="font-display text-3xl text-slate-900 dark:text-white mb-4">Taglish Magic</h3>
                        <p className="text-base text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                           Our AI doesn't just translate; it understands culture. It generates "hugot", "diskarte", and "sweldo" humor that resonates deeply with Pinoy audiences.
                        </p>
                     </div>
                     
                     {/* Chat UI Mock */}
                     <div className="mt-8 bg-[#273338]/5 dark:bg-[#273338] rounded-2xl p-4 border border-slate-100 dark:border-[#9CB080]/20 w-full max-w-md self-center transform group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="flex gap-3 mb-3">
                           <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#2B5748]/50 flex-shrink-0"></div>
                           <div className="bg-white dark:bg-[#2B5748]/40 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-600 dark:text-slate-300">
                              Create a caption for a rainy day coffee promo.
                           </div>
                        </div>
                        <div className="flex gap-3 flex-row-reverse">
                           <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: "#2B5748" }}>AI</div>
                           <div className="p-3 rounded-2xl rounded-tr-none text-sm font-medium" style={{ background: 'rgba(43, 87, 72,0.1)', color: '#2B5748' }}>
                              "Tag-ulan na naman! ☔️ Perfect time para mag-emote with our Hot Choco. Yakap in a cup, bes! ☕️ #BedWeather"
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Feature 2: Top Right — Inverted (dark) */}
               <div className="bg-[#273338] text-white rounded-[2rem] p-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-12 -mt-12 opacity-15 group-hover:opacity-25 transition-opacity" style={{ background: "#2B5748" }}></div>
                  <div className="dot-pattern-dark absolute inset-0 rounded-[2rem] opacity-60"></div>
                  <div className="relative z-10">
                     <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: "#2B5748" }}>
                        <Zap className="w-5 h-5 text-white"/>
                     </div>
                     <h3 className="font-display text-2xl mb-3">Trend Riding</h3>
                     <p className="text-slate-400 text-sm leading-relaxed">Real-time alerts on what's trending in Manila. Never miss a viral wave.</p>
                     <div className="mt-5 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#2B5748" }}></span>
                       <span className="text-xs font-semibold" style={{ color: '#2B5748' }}>Live trend tracking</span>
                     </div>
                  </div>
               </div>

               {/* Feature 3: Bottom Right */}
               <div className="bg-white dark:bg-[#2B5748]/40 rounded-[2rem] p-8 border border-[#273338]/10 dark:border-[#9CB080]/20 shadow-sm group hover:border-[#273338]/10 hover:-translate-y-1 hover:shadow-lg transition-all duration-500">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 bg-[#2B5748]/10 border border-[#2B5748]">
                     <Calendar className="w-5 h-5" style={{ color: '#2B5748' }}/>
                  </div>
                  <h3 className="font-display text-2xl text-slate-900 dark:text-white mb-2">Auto-Calendar</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-5 leading-relaxed">Plan 30 days of content in 1 click. Drag, drop, done.</p>
                  <div className="flex gap-1.5">
                     {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i<4 ? '' : 'bg-slate-100 dark:bg-[#2B5748]/50'}`} style={i<4 ? { background: '#2B5748' } : {}}></div>
                     ))}
                  </div>
               </div>

            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="py-36 relative overflow-hidden">
         {/* Dark base */}
         <div className="absolute inset-0" style={{ background: '#273338' }}></div>
         {/* Dot texture */}
         <div className="absolute inset-0 dot-pattern-dark opacity-100"></div>
         {/* Radial glow top-right */}
         <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20" style={{ background: "#2B5748", transform: 'translate(30%, -30%)' }}></div>
         {/* Radial glow bottom-left */}
         <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10" style={{ background: "#2B5748", transform: 'translate(-30%, 30%)' }}></div>
         
         <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-sm font-semibold" style={{ background: 'rgba(43, 87, 72,0.15)', color: '#FFFFFF', border: '1px solid rgba(43, 87, 72,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#2B5748] animate-pulse-dot"></span>
              1,000+ Filipino MSMEs and counting
            </span>
            <h2 className="font-display text-5xl md:text-7xl text-white mb-6 leading-tight">
               Ready to go{' '}
               <span style={{ background: 'linear-gradient(135deg, #2B5748, #2B5748)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                 Viral?
               </span>
            </h2>
            <p className="text-lg text-slate-400 mb-12 max-w-xl mx-auto leading-relaxed">
               Save 20 hours a week on content creation. AI-powered Taglish captions, auto-scheduling, and live trend alerts.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
               <button 
                  onClick={() => onNavigate(ViewState.SIGNUP)}
                  className="group px-10 py-4 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all"
                  style={{ background: "#2B5748", color: '#FFFFFF', boxShadow: '0 8px 32px -8px rgba(43, 87, 72,0.5)' }}
               >
                  Get Started Free <ArrowRight className="inline-block w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
               </button>
               <button
                  onClick={() => onNavigate(ViewState.DEMO)}
                  className="px-10 py-4 rounded-full font-bold text-base text-white border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
               >
                  See Demo
               </button>
            </div>
            
            <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm font-medium text-slate-500">
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#2B5748' }}/> No credit card required</span>
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#2B5748' }}/> Cancel anytime</span>
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#2B5748' }}/> Free plan available</span>
            </div>
         </div>
      </section>

    </div>
  );
};

export default LandingPage;