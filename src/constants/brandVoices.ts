/** Brand voices offered in brand setup and Settings. */
export const BRAND_VOICES = [
  { label: 'Professional & Trustworthy', desc: 'Corporate, serious, expert' },
  { label: 'Makulit & Fun (Kwelang Pinoy)', desc: 'Meme-style, energetic, relatable' },
  { label: 'Inspirational (Hugot)', desc: 'Emotional, motivational, deep' },
  { label: 'Premium & Minimalist', desc: 'Sleek, high-end, few words' },
  { label: 'Friendly Tita', desc: 'Caring, warm, gossipy but nice' },
];

/** A saved voice from before the fixed list (or the setup default) that isn't one of the options. */
export const isCustomVoice = (voice: string) => !!voice && !BRAND_VOICES.some((v) => v.label === voice);
