import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import PhonePreview from '../calendar/PhonePreview';
import { StatusBadge, type CardStatus } from '../calendar/TimelinePostCard';
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

/** Every business type Kawayan is made for; shown in the strip under the hero. */
export const BUSINESS_TYPES = [
  'Coffee Shop', 'Sari-sari Store', 'Milk Tea Kiosk', 'Panaderia', 'Carinderia',
  'Ukay Boutique', 'Barbershop', 'Hardware Store', 'Lechon Manok Stall', 'Beauty Salon',
  'Frozen Goods Reseller', 'Halamanan / Plant Shop', 'Native Delicacies', 'Print & Layout Shop',
  'Motoparts Supply', 'Poultry Farm',
];

/** The selected shop's week as three post cards (mockup .lane / .post). */
const WeekLane: React.FC<{ shop: Shop }> = ({ shop }) => {
  const items: { status: CardStatus; time?: string; title: string; img: string; when: string }[] = [
    { status: 'published', title: shop.week[0], img: shot(shop, 1), when: 'Mon 3 · 6:00 AM' },
    { status: 'scheduled', time: '9:00 AM', title: shop.week[1], img: shot(shop, 2), when: 'Wed 5 · 9:00 AM' },
    { status: 'draft', title: shop.week[2], img: shot(shop, 3), when: 'Fri 7 · 7:30 AM' },
  ];
  return (
    <div className="lp-shot__main" aria-hidden="true">
      <div className="lp-shot__head">
        <b>This week</b>
        <span className="badge badge-sage mono">Mon 3 – Sun 9</span>
        <span className="badge lp-shot__chan">Facebook</span>
      </div>
      <div className="lp-lane">
        {items.map((item, i) => (
          <article key={`${shop.key}-${i}`} className="lp-post" style={{ '--n': i } as React.CSSProperties}>
            <img src={item.img} alt="" />
            <div>
              <StatusBadge status={item.status} time={item.time} />
              <b>{item.title}</b>
              <small className="mono">{item.when}</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

/**
 * The hero: the pitch, centred over a dot grid, then a framed screenshot of the selected shop in the
 * real Kawayan UI. The shop changes on its own every few seconds (the business-type strip below lists them all).
 */
const HeroShowcase: React.FC<{ onNavigate: (v: ViewState) => void }> = ({ onNavigate }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, 0.2);
  const [pos, setPos] = useState(0);
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
        <span className="lp-hs__kicker"><b>New</b> For every Filipino MSME</span>
        <h1 className="lp-hs__title">
          Social Media <em>On Autopilot.</em>
        </h1>
        <p className="lp-hs__lede">
          Taglish captions, images and a posting schedule for your{' '}
          <b key={shop.type} className="lp-hs__type">{shop.type.toLowerCase()}</b>, all on one calendar.
        </p>
        <div className="lp-hs__actions">
          <button type="button" onClick={() => onNavigate(ViewState.SIGNUP)} className="btn btn-primary btn-lg">
            Start Free Trial <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <a href="#how" className="btn btn-outline btn-lg">See how it works</a>
        </div>
        <p className="lp-hs__fine">Create your first content calendar in minutes. No credit card required.</p>
        <p className="sr-only" aria-live="polite">Showing a sample post for a {shop.type}.</p>
      </div>

      {/* 2. The selected shop, in the real UI */}
      <div className="lp-shot">
        <div className="lp-shot__in">
          <WeekLane shop={shop} />
          <div className="lp-shot__side">
            <PhonePreview businessName={shop.name} caption={shop.caption} imageUrl={shot(shop, 1)} defaultPlatform="facebook" sampleStats />
            <span className="lp-hs__ai"><Sparkles aria-hidden /> Image made by Kawayan AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroShowcase;
