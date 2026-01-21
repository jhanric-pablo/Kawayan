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
      className="flex flex-col relative bg-slate-50 dark:bg-slate-900 transition-colors overflow-x-hidden"
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
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/50 animate-bounce transition-opacity duration-500"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Scroll to Advance</span>
            <div className="w-px h-8 bg-gradient-to-b from-emerald-500 to-transparent"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Text */}
              <div 
                ref={contentRef}
                className="text-center lg:text-left transition-transform duration-100 ease-out z-20"
              >
                <h1 
                  className="text-6xl sm:text-7xl lg:text-8xl font-black text-white tracking-tight mb-8 leading-[0.95]"
                  style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.9))' }}
                >
                  Social Media <br /> 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
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
                    className="group/btn relative px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold text-lg overflow-hidden shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1 w-full sm:w-auto hover:bg-emerald-50"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      Start Free Trial <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => onNavigate(ViewState.DEMO)}
                    className="px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  >
                    <Play className="w-5 h-5 fill-current" /> Demo Mode
                  </button>
                </div>
              </div>

              {/* Right Column: Floating Cards (Parallax) */}
              <div className="relative h-[600px] hidden lg:block perspective-1000">
                
                {/* Card 1: Main Visual */}
                <div 
                  className="absolute top-10 right-10 w-80 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-4 border border-slate-100 dark:border-slate-700 z-20 animate-float"
                  style={{ 
                    transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px) rotateY(-10deg)`,
                    transition: 'transform 0.1s ease-out'
                  }}
                >
                  <div className="h-48 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4 overflow-hidden relative">
                     <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-blue-400/20"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-emerald-500 animate-pulse"/>
                     </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                     <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600">AI</div>
                     <span>Generating content...</span>
                  </div>
                </div>

                {/* Card 2: Stats (Glassmorphism) */}
                <div 
                  className="absolute bottom-20 left-10 w-64 glass-card p-6 rounded-3xl z-30 shadow-xl backdrop-blur-xl"
                  style={{ 
                    transform: `translate(${mousePos.x * 50}px, ${mousePos.y * 50}px) rotateY(10deg)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><TrendingUp className="w-5 h-5"/></div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Virality</span>
                   </div>
                   <div className="text-4xl font-black text-slate-800 dark:text-white mb-1">98%</div>
                   <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="bg-orange-500 h-1.5 rounded-full w-[98%]"></div>
                   </div>
                </div>

                {/* Card 3: Floating Elements */}
                <div 
                   className="absolute top-1/2 left-1/2 w-20 h-20 bg-emerald-500 rounded-2xl shadow-lg z-10 flex items-center justify-center text-white rotate-12"
                   style={{ 
                    transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px) translate(-50%, -50%)`,
                    transition: 'transform 0.2s ease-out'
                  }}
                >
                   <Zap className="w-10 h-10 fill-current" />
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* Marquee Section */}
      <div className="w-full bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700 py-8 overflow-hidden relative z-10">
         <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white dark:from-slate-800 to-transparent z-10"></div>
         <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white dark:from-slate-800 to-transparent z-10"></div>
         
         <div className="flex w-[200%] animate-scroll">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex justify-around w-1/2 items-center gap-12 px-12 min-w-max">
                 <span className="text-2xl font-black text-slate-300 dark:text-slate-600">KAIN<span className="text-emerald-500">.</span>PO</span>
                 <span className="text-2xl font-serif italic text-slate-300 dark:text-slate-600">ManilaStrut</span>
                 <span className="text-2xl font-bold tracking-widest text-slate-300 dark:text-slate-600">BARAKO</span>
                 <span className="text-2xl font-mono text-slate-300 dark:text-slate-600">TechTito</span>
                 <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">Lola's<span className="font-light">Best</span></span>
              </div>
            ))}
         </div>
      </div>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 relative z-10">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
               <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6">Master the Algorithm.</h2>
               <p className="text-xl text-slate-500 dark:text-slate-400">Native Filipino AI understanding. No more robotic translations.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-6 h-auto md:h-[600px]">
               
               {/* Feature 1: Large Left */}
               <div className="md:col-span-2 row-span-2 bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-700 shadow-lg relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30"></div>
                  <div className="relative z-10 h-full flex flex-col justify-between">
                     <div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white mb-6">
                           <Sparkles className="w-6 h-6"/>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Taglish Magic</h3>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md">
                           Our AI doesn't just translate; it understands culture. It generates "hugot", "diskarte", and "sweldo" humor that resonates deeply with Pinoy audiences.
                        </p>
                     </div>
                     
                     {/* Chat UI Mock */}
                     <div className="mt-8 bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 w-full max-w-md self-center transform group-hover:scale-105 transition-transform duration-500">
                        <div className="flex gap-3 mb-3">
                           <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                           <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-600 dark:text-slate-300">
                              Create a caption for a rainy day coffee promo.
                           </div>
                        </div>
                        <div className="flex gap-3 flex-row-reverse">
                           <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">AI</div>
                           <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl rounded-tr-none text-sm text-emerald-800 dark:text-emerald-200">
                              "Tag-ulan na naman! ☔️ Perfect time para mag-emote with our Hot Choco. Yakap in a cup, bes! ☕️ #BedWeather"
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Feature 2: Top Right */}
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2rem] p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                     <TrendingUp className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                     <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4 backdrop-blur">
                        <Zap className="w-5 h-5 text-yellow-400"/>
                     </div>
                     <h3 className="text-xl font-bold mb-2">Trend Riding</h3>
                     <p className="text-slate-300 text-sm">Real-time alerts on what's trending in Manila. Never miss a viral wave.</p>
                  </div>
               </div>

               {/* Feature 3: Bottom Right */}
               <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-700 shadow-lg group hover:border-emerald-500 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-orange-600">
                     <Calendar className="w-5 h-5"/>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Auto-Calendar</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Plan 30 days of content in 1 click. Drag, drop, done.</p>
                  <div className="flex gap-1">
                     {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i<4 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                     ))}
                  </div>
               </div>

            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
         <div className="absolute inset-0 bg-slate-900 dark:bg-black"></div>
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         
         <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight">
               Ready to go <span className="text-emerald-500">Viral?</span>
            </h2>
            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
               Join 1,000+ Filipino MSMEs saving 20 hours a week on content creation.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6">
               <button 
                  onClick={() => onNavigate(ViewState.SIGNUP)}
                  className="px-10 py-5 bg-emerald-500 text-white rounded-2xl font-bold text-xl hover:bg-emerald-400 transition shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transform hover:scale-105"
               >
                  Get Started Free
               </button>
            </div>
            
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm font-medium text-slate-500">
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> No credit card required</span>
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Cancel anytime</span>
               <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Free plan available</span>
            </div>
         </div>
      </section>

    </div>
  );
};

export default LandingPage;