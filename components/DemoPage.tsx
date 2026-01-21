import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, ArrowRight, CheckCircle2, Play } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
}

const steps = [
  {
    title: "1. Tell us about your Brand",
    description: "Start by defining your industry, target audience, and brand voice. Kawayan AI learns your style to generate content that sounds exactly like you.",
    video: "/video/video.mp4"
  },
  {
    title: "2. Native 'Taglish' Magic",
    description: "Our AI understands Pinoy culture. Generate captions that use the right amount of 'hugot', 'diskarte', and local slang to resonate with your audience.",
    video: "/video/video.mp4"
  },
  {
    title: "3. Trending Visual Inspiration",
    description: "Get AI-powered image prompts and visual ideas based on current Manila trends. Never worry about what to post again.",
    video: "/video/video.mp4"
  },
  {
    title: "4. Smart Content Calendar",
    description: "Plan your entire month in minutes. Drag and drop posts, schedule for peak Philippine engagement times, and stay consistent effortlessly.",
    video: "/video/video.mp4"
  },
  {
    title: "5. Real-time Analytics",
    description: "Track your growth across Facebook, Instagram, and TikTok. See which 'Taglish' hooks are performing best and double down on what works.",
    video: "/video/video.mp4"
  },
  {
    title: "6. Scale your Business",
    description: "Focus on running your business while Kawayan AI handles the daily social media grind. Join thousands of Pinoy MSMEs going viral.",
    video: "/video/video.mp4"
  }
];

const DemoPage: React.FC<Props> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden relative">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-700">
          <div 
            className="h-full bg-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8 sm:p-12">
          {/* Header Content */}
          <div 
            key={currentStep}
            className={`text-center mb-10 transition-all duration-500 ${direction === 1 ? 'animate-in fade-in slide-in-from-right-8' : direction === -1 ? 'animate-in fade-in slide-in-from-left-8' : ''}`}
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
              {steps[currentStep].title}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-900 shadow-xl group mb-10">
            <video 
              key={steps[currentStep].video + currentStep}
              src={steps[currentStep].video}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            
            {/* Step Counter */}
            <div className="absolute bottom-6 right-6 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-xs font-black tracking-widest uppercase">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div 
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${currentStep === i ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}
                />
              ))}
            </div>

            {currentStep === steps.length - 1 ? (
              <button 
                onClick={() => onNavigate(ViewState.SIGNUP)}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 transform hover:-translate-y-1"
              >
                Start Free Trial <CheckCircle2 className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={nextStep}
                className="flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-lg transform hover:-translate-y-1"
              >
                Next Step <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <button 
        onClick={() => onNavigate(ViewState.LANDING)}
        className="mt-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-all"
      >
        Back to Home
      </button>
    </div>
  );
};

export default DemoPage;
