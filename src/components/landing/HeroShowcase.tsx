import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import PhonePreview from '../calendar/PhonePreview';
import TimelinePostCard, { type TimelineCardItem } from '../calendar/TimelinePostCard';
import { ViewState } from '../../types';
import { prefersReducedMotion, useInView } from './useLandingMotion';

interface Shop {
  type: string;
  name: string;
  caption: string;
  week: [string, string, string];
  /** Images are public/hero/ai/<key>-1..3.jpg, one per post of the week. */
  key: string;
}

/** Made with the same image model Kawayan uses for posts (Cloudflare Workers AI, SDXL), then picked by hand. */
const shot = (shop: Shop, n: 1 | 2 | 3) => `/hero/ai/${shop.key}-${n}.jpg`;

/** Sample shops for the hero. Each shows what Kawayan would draft for that kind of business. */
const SHOPS: Shop[] = [
  { type: 'Panaderia', name: 'Aling Nena’s Bakery', caption: 'Pandesal alert! Mainit pa at bagong luto, 6 AM pa lang. Kita-kits sa tindahan!', week: ['Pandesal alert', 'Ube ensaymada', 'Behind the oven'], key: 'panaderia' },
  { type: 'Milk Tea Kiosk', name: 'Tea Tayo', caption: 'Payday treat! Buy 1 take 1 sa lahat ng milk tea hanggang Linggo. Tara na, bes!', week: ['Buy 1 take 1', 'New: brown sugar', 'Rainy-day combo'], key: 'milktea' },
  { type: 'Sari-sari Store', name: 'Tindahan ni Aling Rosa', caption: 'Kumpleto na ulit! May yelo, load at paborito mong chichirya. Bukas hanggang 10 PM.', week: ['Restock day', 'Load promo', 'Bagong chichirya'], key: 'sarisari' },
  { type: 'Carinderia', name: 'Kusina ni Lola', caption: 'Ulam of the day: sinigang na baboy at adobong manok. Unli rice pa rin, mga suki!', week: ['Ulam of the day', 'Lunch combo', 'Sunday special'], key: 'carinderia' },
  { type: 'Coffee Shop', name: 'Barako Brew', caption: 'Antok pa? Kapeng barako na, mainit at matapang. 20% off para sa mga estudyante today.', week: ['Barako Monday', 'Student promo', 'Iced latte drop'], key: 'coffee' },
  { type: 'Ukay Boutique', name: 'Ukay Finds QC', caption: 'New drop mamayang 7 PM! Vintage jackets at denim, tig-₱150 lang. First come, first served.', week: ['New drop 7 PM', 'Denim day', 'Customer OOTD'], key: 'ukay' },
  { type: 'Barbershop', name: 'Gupit Kanto', caption: 'Fresh cut bago mag-weekend? Walk-in welcome, ₱120 lang ang gupit hanggang Sabado.', week: ['Weekend cuts', 'Fade of the week', 'Student rate'], key: 'barbershop' },
  { type: 'Halamanan / Plant Shop', name: 'Halaman ni Mang Ben', caption: 'Bagong dating: monstera at snake plants. Libreng paso para sa unang 10 buyers!', week: ['New arrivals', 'Plant care tips', 'Free paso promo'], key: 'plants' },
  { type: 'Lechon Manok Stall', name: 'Manok ni Juan', caption: 'Hot from the uling! Lechon manok + java rice combo, ₱299 lang ngayong araw.', week: ['Combo of the day', 'Family pack', 'Behind the grill'], key: 'lechon' },
  { type: 'Beauty Salon', name: 'Salon de Gracia', caption: 'Rebond + treatment promo buong buwan. Book na sa Messenger, limited slots lang!', week: ['Rebond promo', 'Before & after', 'Nail art week'], key: 'salon' },
  { type: 'Hardware Store', name: 'Ferreteria Santos', caption: 'Tag-ulan na, handa na ba ang bubong? Sealant at yero, kumpleto kami. May delivery sa Marikina.', week: ['Rainy-season prep', 'Paint week', 'Delivery reminder'], key: 'hardware' },
  { type: 'Native Delicacies', name: 'Kakanin ni Aling Pacing', caption: 'Bibingka, puto at kutsinta, bagong luto ngayong umaga! Pre-order na para sa handaan.', week: ['Kakanin tray', 'Pre-order reminder', 'Fiesta special'], key: 'kakanin' },
];

const STEP_MS = 4200;

/** The business types that scroll down the right edge, as before. */
const BUSINESS_TYPES = [
  'Coffee Shop', 'Sari-sari Store', 'Milk Tea Kiosk', 'Panaderia', 'Carinderia',
  'Ukay Boutique', 'Barbershop', 'Hardware Store', 'Lechon Manok Stall', 'Beauty Salon',
  'Frozen Goods Reseller', 'Halamanan / Plant Shop', 'Native Delicacies', 'Print & Layout Shop',
  'Motoparts Supply', 'Poultry Farm',
];

/** The selected shop's week, as the real timeline cards from the calendar. */
const WeekLane: React.FC<{ shop: Shop }> = ({ shop }) => {
  const items: TimelineCardItem[] = [
    { key: 'a', day: 3, status: 'published', title: shop.week[0], imageUrl: shot(shop, 1) },
    { key: 'b', day: 5, status: 'scheduled', time: '9:00 AM', title: shop.week[1], imageUrl: shot(shop, 2) },
    { key: 'c', day: 7, status: 'draft', title: shop.week[2], imageUrl: shot(shop, 3) },
  ];
  const days = ['Mon 3', 'Wed 5', 'Fri 7'];
  return (
    <div className="lp-hs-lane" aria-hidden="true">
      <p className="lp-hs-lane__head">This week</p>
      {items.map((item, i) => (
        <div key={`${shop.type}-${item.key}`} className="lp-hs-lane__slot" style={{ '--n': i } as React.CSSProperties}>
          <span className="lp-hs-lane__day">{days[i]}</span>
          <TimelinePostCard item={item} onOpen={() => {}} />
        </div>
      ))}
    </div>
  );
};

/**
 * The hero's three parts: the pitch, the selected shop shown in the real Kawayan UI,
 * and a roller of business types that picks the shop (on its own, or by click).
 */
const HeroShowcase: React.FC<{ onNavigate: (v: ViewState) => void }> = ({ onNavigate }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, 0.2);
  const [pos, setPos] = useState(0); // keeps counting up, so rows slide instead of jumping on wrap
  const shop = SHOPS[((pos % SHOPS.length) + SHOPS.length) % SHOPS.length];

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const t = setTimeout(() => setPos((p) => p + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [pos, inView]);

  return (
    <div ref={rootRef} className="lp-hs">
      {/* 1. The pitch */}
      <div className="lp-hs__copy">
        <span className="lp-hs__kicker"><i /> For every Filipino MSME</span>
        <h1 className="lp-hs__title">
          Social Media <br />
          <span className="text-sage-400">On Autopilot.</span>
        </h1>
        <p className="lp-hs__lede">
          Taglish captions, images and a posting schedule for your{' '}
          <b key={shop.type} className="lp-hs__type">{shop.type.toLowerCase()}</b>, all on one calendar.
        </p>
        <div className="lp-hs__actions">
          <button type="button" onClick={() => onNavigate(ViewState.SIGNUP)} className="lp-hs__cta">
            Start Free Trial <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
          <a href="#how" className="lp-hs__link">See how it works</a>
        </div>
        <p className="lp-hs__fine">Create your first content calendar in minutes. No credit card required.</p>
        <p className="sr-only" aria-live="polite">Showing a sample post for a {shop.type}.</p>
      </div>

      {/* 2. The selected shop, in the real UI */}
      <div className="lp-hs__stage">
        <WeekLane shop={shop} />
        <div className="lp-hs__phone">
          <PhonePreview businessName={shop.name} caption={shop.caption} imageUrl={shot(shop, 1)} defaultPlatform="facebook" sampleStats />
          <span className="lp-hs__ai"><Sparkles aria-hidden /> Image made by Kawayan AI</span>
        </div>
      </div>

      {/* 3. Business types scrolling down the right edge (the original marquee) */}
      <div className="lp-hs__marquee" aria-hidden="true">
        <div className="flex flex-col items-end gap-3 animate-scroll-y">
          {[...BUSINESS_TYPES, ...BUSINESS_TYPES].map((biz, i) => (
            <div key={i} className="flex w-max items-center gap-2.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-sage-400" />
              <span className="eyebrow lg:text-xs text-white/80 whitespace-nowrap">{biz}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroShowcase;
