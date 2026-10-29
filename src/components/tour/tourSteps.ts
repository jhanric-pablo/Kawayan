import { Sparkles, ChartGantt, Layers, BarChart3, Share2, CreditCard, Settings as SettingsIcon, MessageSquare, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TourStep {
  /** data-tour value of the element to spotlight; null centres the card. */
  anchor: string | null;
  /** Short name for the step dots. */
  name: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

/**
 * Copy follows md/SYSTEM_GUIDE.md §2.2 (main features) and §10.3 (navigation).
 * Every anchor here lives on the Calendar view, the sticky nav, or the floating
 * support bubble — all present at once — so the tour never has to change views.
 * A step whose anchor is missing is skipped at runtime.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: null,
    name: 'Welcome',
    title: 'Your brand is set up',
    body: "Kawayan now writes in your voice. Here's a quick tour of where everything lives — about a minute.",
    icon: Sparkles,
  },
  {
    anchor: 'calendar-grid',
    name: 'Timeline',
    title: 'This is your channel timeline',
    body: 'Each row is a channel and each column a day of the month. Click a post to see its details, or an empty slot to write one.',
    icon: ChartGantt,
  },
  {
    anchor: 'plan-month',
    name: 'Plan',
    title: 'Start with "Plan month"',
    body: 'Kawayan drafts a full month of Taglish captions and image prompts in your brand voice. Do this first — the timeline stays empty until you do.',
    icon: Layers,
  },
  {
    anchor: 'nav-insights',
    name: 'Insights',
    title: "See what's working",
    body: 'Compare this period with the last one, find your best posts, put up to three side by side, and download your numbers.',
    icon: BarChart3,
  },
  {
    anchor: 'nav-social',
    name: 'Social',
    title: 'Connect your pages',
    body: 'Link your Facebook Page and Instagram once. After that, Post now and Schedule in the post studio publish to them for you.',
    icon: Share2,
  },
  {
    anchor: 'nav-billing',
    name: 'Billing',
    title: 'Top up and go Pro',
    body: 'Your prepaid wallet, funded through PayMongo (GCash, Maya or card). Free gives you 8 posts a month, Pro gives you 16, and extra posts are ₱150 each.',
    icon: CreditCard,
  },
  {
    anchor: 'nav-settings',
    name: 'Settings',
    title: 'Tune your brand anytime',
    body: 'Change your brand voice, audience and themes, and switch between light and dark mode.',
    icon: SettingsIcon,
  },
  {
    anchor: 'help-button',
    name: 'Help',
    title: 'Help is one click away',
    body: 'Ask the AI assistant, raise a ticket, or request a call with a real support agent. Press ⌘K (Ctrl+K) from anywhere.',
    icon: MessageSquare,
  },
  {
    anchor: null,
    name: 'Done',
    title: "That's the whole tour",
    body: 'Plan your first month whenever you are ready. You can replay this walkthrough any time from Settings → Appearance.',
    icon: Rocket,
  },
];
