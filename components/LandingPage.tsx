import React, { useRef, Suspense } from 'react';
import { ViewState } from '../types';
import { ArrowRight, Sparkles, TrendingUp, Calendar, Zap, CheckCircle2, Play } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Environment, Stars } from '@react-three/drei';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Props {
  onNavigate: (view: ViewState) => void;
}

// --- 3D Components ---

const AIOrb = () => {
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.rotation.x = t * 0.2;
      meshRef.current.rotation.y = t * 0.3;
    }
  });

  return (
    <Float speed={4} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef} scale={2.4}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color="#10b981"
          attach="material"
          distort={0.5}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
};

const BackgroundParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
       <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
       <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
       <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, delay, y }: any) => {
  return (
    <motion.div 
      style={{ y }}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      viewport={{ once: true }}
      className="p-8 rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/20 dark:border-slate-700 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition group"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-emerald-500 dark:to-teal-700 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
    </motion.div>
  );
};

const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <div className="flex flex-col w-full overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
      
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[90vh] flex items-center">
        <BackgroundParticles />
        
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left: Text Content */}
          <div className="relative z-10 pt-20 lg:pt-0">
             <motion.div 
               initial={{ opacity: 0, x: -50 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.8 }}
             >
               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-8 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Generative AI for Philippines
               </div>

               <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tight mb-8 leading-[1.1]">
                  Social Media <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 animate-gradient">
                     on Autopilot
                  </span>
               </h1>

               <p className="text-xl text-slate-600 dark:text-slate-300 max-w-xl mb-10 leading-relaxed">
                  Generate viral Taglish captions, create stunning visuals, and schedule your entire month in clicks. The only AI trained on Filipino culture.
               </p>

               <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => onNavigate(ViewState.LOGIN)}
                    className="px-8 py-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-full font-bold text-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition transform hover:-translate-y-1 shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2"
                  >
                    Start Free Trial <ArrowRight className="w-5 h-5" />
                  </button>
                  <button 
                     onClick={() => {
                        document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                     }}
                     className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 rounded-full font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" /> Watch Demo
                  </button>
               </div>

               <div className="mt-12 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex -space-x-3">
                     {[1,2,3,4].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                           {String.fromCharCode(64+i)}
                        </div>
                     ))}
                  </div>
                  <p>Trusted by <span className="text-slate-900 dark:text-white font-bold">500+ MSMEs</span> in PH</p>
               </div>
             </motion.div>
          </div>

          {/* Right: 3D Scene */}
          <div className="h-[500px] lg:h-[800px] w-full relative z-0">
             <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <Suspense fallback={null}>
                  <Environment preset="city" />
                  <ambientLight intensity={0.5} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} color="#10b981" />
                  <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
                  <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                  <AIOrb />
                </Suspense>
             </Canvas>
             
             {/* Floating UI Elements over 3D */}
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 1, duration: 1 }}
               className="absolute top-1/4 right-0 lg:right-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-4 rounded-2xl border border-white/20 dark:border-slate-600 shadow-2xl max-w-xs"
             >
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <TrendingUp className="w-4 h-4" />
                   </div>
                   <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Virality Score</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white">98/100</p>
                   </div>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                   <div className="bg-orange-500 h-1.5 rounded-full w-[98%]"></div>
                </div>
             </motion.div>
          </div>

        </div>
      </section>

      {/* --- FEATURES SECTION WITH PARALLAX --- */}
      <section id="features" className="py-32 relative">
         <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-800/30 skew-y-3 transform origin-top-left -z-10"></div>
         
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
               <motion.h2 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6"
               >
                 Built for <span className="text-emerald-500">Filipino Growth</span>
               </motion.h2>
               <motion.p 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.1 }}
                 viewport={{ once: true }}
                 className="text-lg text-slate-600 dark:text-slate-300"
               >
                 Our AI understands the nuances of "Hugot", "Sweldo", and Filipino buying behavior better than any generic tool.
               </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="md:mt-0">
                  <FeatureCard 
                    y={y1}
                    delay={0}
                    icon={<Sparkles className="w-6 h-6 text-white"/>}
                    title="Taglish Magic"
                    desc="Don't sound like a robot. Our AI speaks fluent Taglish, ensuring your captions feel authentic and 'patok' to your audience."
                  />
               </div>
               <div className="md:mt-12">
                   <FeatureCard 
                    y={y2}
                    delay={0.2}
                    icon={<Zap className="w-6 h-6 text-white"/>}
                    title="Trend Riding"
                    desc="Get real-time suggestions based on what's trending in the Philippines—from 'Ber Months' to the latest viral memes."
                  />
               </div>
               <div className="md:mt-24">
                   <FeatureCard 
                    y={y3}
                    delay={0.4}
                    icon={<Calendar className="w-6 h-6 text-white"/>}
                    title="One-Click Plan"
                    desc="Generate a whole month's worth of content ideas in seconds. Drag, drop, and schedule effortlessly."
                  />
               </div>
            </div>
         </div>
      </section>

      {/* --- DEMO / UI SHOWCASE --- */}
      <section id="demo" className="py-24 bg-slate-900 text-white relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
         
         <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
               <h2 className="text-4xl font-bold mb-6">Your Personal Creative Studio</h2>
               <div className="space-y-6">
                  {[
                    "Auto-generates images from text",
                    "Calculates virality potential before you post",
                    "Suggests relevant #hashtags",
                    "Schedules specifically for PH timezones"
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-3 text-lg text-slate-300"
                    >
                       <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                         <CheckCircle2 className="w-4 h-4" />
                       </div>
                       {item}
                    </motion.div>
                  ))}
               </div>
            </div>
            
            <div className="flex-1 perspective-1000">
               <motion.div 
                 initial={{ rotateY: 10, rotateX: 10, opacity: 0 }}
                 whileInView={{ rotateY: -5, rotateX: 5, opacity: 1 }}
                 transition={{ duration: 1 }}
                 viewport={{ once: true }}
                 className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-2 md:p-4 transform hover:rotate-0 transition-transform duration-500"
               >
                  <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video relative group">
                      {/* Fake UI */}
                      <div className="absolute top-4 left-4 right-4 flex gap-2">
                         <div className="w-1/3 h-24 bg-slate-800 rounded-lg animate-pulse"></div>
                         <div className="w-1/3 h-24 bg-slate-800 rounded-lg animate-pulse delay-100"></div>
                         <div className="w-1/3 h-24 bg-emerald-900/20 border border-emerald-500/50 rounded-lg flex items-center justify-center">
                            <span className="text-emerald-500 text-xs font-bold">Generated</span>
                         </div>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-slate-900 to-transparent flex items-end p-6">
                         <div className="w-full">
                            <div className="w-1/2 h-4 bg-slate-700 rounded mb-2"></div>
                            <div className="w-3/4 h-4 bg-slate-700 rounded"></div>
                         </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                         <button className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold flex items-center gap-2">
                            <Play className="w-4 h-4 fill-slate-900" /> See it in action
                         </button>
                      </div>
                  </div>
               </motion.div>
            </div>
         </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-32 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 -z-20"></div>
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] -z-10"></div>
         
         <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               whileInView={{ scale: 1, opacity: 1 }}
               transition={{ type: "spring", bounce: 0.4 }}
            >
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-8">
                 Ready to dominate?
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto">
                 Join the waitlist of MSMEs using Kawayan AI to scale their business with less effort.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                 <button 
                    onClick={() => onNavigate(ViewState.LOGIN)}
                    className="px-10 py-5 bg-emerald-600 text-white rounded-full font-bold text-xl hover:bg-emerald-700 transition shadow-xl hover:shadow-emerald-500/40 transform hover:-translate-y-1"
                 >
                    Get Started Now
                 </button>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                 <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> No credit card required</span>
                 <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Cancel anytime</span>
              </div>
            </motion.div>
         </div>
      </section>

    </div>
  );
};

export default LandingPage;
