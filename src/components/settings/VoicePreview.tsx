import React from 'react';

/** One sample caption per voice, so owners can hear a voice before choosing it. {name} is their shop. */
const SAMPLES: Record<string, string> = {
  'Professional & Trustworthy': 'Now taking orders for the week at {name}. Quality you can count on, ready on time. Send us a message to reserve yours.',
  'Makulit & Fun (Kwelang Pinoy)': 'Sino’ng gutom diyan? Bawal ang sad today, may bago kami sa {name}! Comment “GUTOM” at chika tayo.',
  'Inspirational (Hugot)': 'Hindi lahat ng bagay kailangang madaliin. Pero yung order mo sa {name}? Ready na agad, para sa’yo.',
  'Premium & Minimalist': 'New this week at {name}. Made in small batches. Limited.',
  'Friendly Tita': 'Mga anak, kumain na ba kayo? May bagong luto dito sa {name}. Dalhan niyo rin si nanay, ha!',
};

/** A sample post that rewrites itself in the chosen voice. Re-keyed on voice change so it fades in. */
const VoicePreview: React.FC<{ voice: string; businessName: string; audience: string }> = ({ voice, businessName, audience }) => {
  const name = businessName || 'your shop';
  const sample = SAMPLES[voice];
  return (
    <div className="rounded-(--radius-lg) border border-(--border) bg-(--bg-alt) p-4" aria-live="polite">
      <p className="eyebrow text-(--fg-subtle)">Sample caption</p>
      <div className="mt-2.5 rounded-(--radius-md) border border-(--border) bg-(--card) p-3.5 shadow-xs">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-(--primary-accent) text-xs font-semibold text-(--primary-accent-fg)" aria-hidden>
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 truncate text-ui font-semibold text-(--fg)">{name}</span>
        </div>
        <p key={voice} className="animate-fade-in text-sm leading-relaxed text-(--fg)">
          {sample ? sample.replace('{name}', name) : voice ? `Captions follow your own voice: “${voice}”.` : 'Pick a voice to hear how your captions will sound.'}
        </p>
      </div>
      <p className="mt-2.5 text-xs text-(--fg-muted)">
        {audience ? <>Written for <b className="font-semibold text-(--fg)">{audience}</b>. </> : null}
        Kawayan writes a fresh caption for every post.
      </p>
    </div>
  );
};

export default VoicePreview;
