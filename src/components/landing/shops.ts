// Sample shops shown on the landing hero and the /how-it-works story.

export interface Shop {
  type: string;
  name: string;
  caption: string;
  week: [string, string, string];
  /** Images are public/hero/ai/<key>-1..3.jpg, one per post of the week. */
  key: string;
}

/** Made with the same image model Kawayan uses for posts (Cloudflare Workers AI, SDXL), then picked by hand. */
export const shot = (shop: Shop, n: 1 | 2 | 3) => `/hero/ai/${shop.key}-${n}.jpg`;

/** Sample shops for the hero. Each shows what Kawayan would draft for that kind of business. */
export const SHOPS: Shop[] = [
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
