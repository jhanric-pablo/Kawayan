import React, { useState, useEffect } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt } from '../services/geminiService';
import { Calendar as CalendarIcon, Loader2, Plus, Wand2, Image as ImageIcon, CheckCircle, RefreshCcw } from 'lucide-react';

interface Props {
  profile: BrandProfile;
}

const ContentCalendar: React.FC<Props> = ({ profile }) => {
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedPost | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    // Initial load of content plan
    handleGeneratePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    const newIdeas = await generateContentPlan(profile, "October"); // Mocking October
    setIdeas(newIdeas);
    setLoadingPlan(false);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // Reset selection if clicking a different day
    if (generatedContent && new Date(generatedContent.date).getDate() !== day) {
      setGeneratedContent(null);
    }
  };

  const handleGeneratePost = async (idea: ContentIdea) => {
    setGeneratingPost(true);
    setGeneratedContent(null);
    try {
      const { caption, imagePrompt } = await generatePostCaptionAndImagePrompt(profile, idea.topic);
      const newPost: GeneratedPost = {
        id: Date.now().toString(),
        date: `2025-10-${idea.day.toString().padStart(2, '0')}`,
        topic: idea.topic,
        caption,
        imagePrompt,
        status: 'Draft'
      };
      setGeneratedContent(newPost);
    } catch (e) {
      alert("Failed to generate content. Please try again.");
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedContent) return;
    setLoadingImage(true);
    const b64 = await generateImageFromPrompt(generatedContent.imagePrompt + ", high quality, professional photography style, 4k");
    if (b64) {
      setGeneratedContent({ ...generatedContent, imageUrl: b64 });
    } else {
      alert("Failed to generate image. Please try again.");
    }
    setLoadingImage(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Calendar Grid */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-emerald-600" />
            <h2 className="text-2xl font-bold text-slate-800">Content Plan: October 2025</h2>
          </div>
          <button 
            onClick={handleGeneratePlan}
            disabled={loadingPlan}
            className="text-sm flex items-center gap-2 text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition"
          >
            {loadingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh Plan
          </button>
        </div>

        {loadingPlan ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-500" />
            <p>Brainstorming with Kawayan AI...</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {ideas.map((idea) => (
              <div
                key={idea.day}
                onClick={() => handleDayClick(idea.day)}
                className={`aspect-[4/5] rounded-xl border-2 p-3 cursor-pointer transition-all hover:shadow-md relative group flex flex-col justify-between ${
                  selectedDay === idea.day
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-slate-100 bg-slate-50 hover:border-emerald-200'
                }`}
              >
                <div>
                  <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${selectedDay === idea.day ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500'}`}>
                    {idea.day}
                  </span>
                  <h4 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{idea.title}</h4>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide bg-white px-2 py-1 rounded border border-slate-200">{idea.format}</span>
                </div>
              </div>
            ))}
            {/* Fillers for empty days visual */}
            {Array.from({ length: Math.max(0, 10 - ideas.length) }).map((_, i) => (
               <div key={`empty-${i}`} className="aspect-[4/5] rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                 <Plus className="w-6 h-6" />
               </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Panel */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden h-[calc(100vh-140px)] sticky top-6">
        {selectedDay ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Day {selectedDay}</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {ideas.find(i => i.day === selectedDay)?.title || "Custom Post"}
              </h3>
              <p className="text-sm text-slate-500 mt-2 line-clamp-3">
                {ideas.find(i => i.day === selectedDay)?.topic}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!generatedContent ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">Ready to create?</h4>
                    <p className="text-slate-500 text-sm max-w-[200px] mx-auto">Generate Taglish captions and image ideas instantly.</p>
                  </div>
                  <button
                    onClick={() => {
                      const idea = ideas.find(i => i.day === selectedDay);
                      if (idea) handleGeneratePost(idea);
                    }}
                    disabled={generatingPost}
                    className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {generatingPost ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Drafting...
                      </span>
                    ) : 'Generate Content'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  {/* Generated Caption */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Caption (Taglish)</label>
                    <textarea 
                      className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-48"
                      value={generatedContent.caption}
                      readOnly
                    />
                  </div>

                  {/* Generated Image/Prompt */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                      Visuals
                      {!generatedContent.imageUrl && (
                         <button 
                           onClick={handleGenerateImage}
                           disabled={loadingImage}
                           className="text-emerald-600 text-[10px] bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition flex items-center gap-1"
                         >
                            {loadingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3"/>}
                            Generate Image
                         </button>
                      )}
                    </label>
                    
                    {generatedContent.imageUrl ? (
                      <div className="relative group">
                         <img src={generatedContent.imageUrl} alt="Generated" className="w-full rounded-xl border border-slate-200 shadow-sm" />
                         <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                           <CheckCircle className="w-3 h-3" /> AI Generated
                         </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-slate-500 text-xs italic">
                        <p className="mb-2"><span className="font-semibold text-slate-700">Prompt Idea:</span> {generatedContent.imagePrompt}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {generatedContent && (
               <div className="p-6 border-t border-slate-100 bg-white">
                 <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition">
                   Schedule Post
                 </button>
               </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a day from the calendar to start creating content.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentCalendar;
