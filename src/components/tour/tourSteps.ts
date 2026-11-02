import {
  Sparkles, CalendarDays, LayoutGrid, ArrowLeftRight, Inbox, Sun, Layers, PenLine, Bell, Gauge,
  BarChart3, Share2, CreditCard, Settings as SettingsIcon, MessageSquare, Rocket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TourStep {
  /** data-tour value of the element to spotlight; null centres the card. */
  anchor: string | null;
  /** Group shown above the title ("Your calendar"). */
  chapter: string;
  title: string;
  body: string;
  /** Short points under the body, when a step covers a few things. */
  points?: string[];
  /** A practical hint, shown in its own line. */
  tip?: string;
  icon: LucideIcon;
}

/**
 * The walkthrough, in the order someone would use Kawayan: the calendar, making posts,
 * keeping track, then the account pages. Every anchor is on the calendar screen or the app
 * frame around it, so the tour never changes pages. A step whose anchor isn't on screen
 * (for example the tray on a phone) is skipped.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: null,
    chapter: 'Welcome',
    title: 'A quick look around',
    body: 'Two minutes to see where everything is: your calendar, how posts get made, and where your account lives.',
    points: ['Use the arrow keys or the buttons to move', 'Press Esc to leave at any time'],
    icon: Sparkles,
  },

  // ── Your calendar ──
  {
    anchor: 'calendar-views',
    chapter: 'Your calendar',
    title: 'Three ways to see your month',
    body: 'Switch views here. Kawayan remembers the one you used last.',
    points: ['Month: the whole month, each post as a picture', 'Timeline: one row per page (Facebook, Instagram)', 'List: everything in date order'],
    icon: CalendarDays,
  },
  {
    anchor: 'calendar-grid',
    chapter: 'Your calendar',
    title: 'Your month at a glance',
    body: 'Each day holds one post. Click a post to see when it goes out, to which pages, and its caption. Click an empty day to write a post for it.',
    tip: 'The coloured label shows where a post is: Idea, Draft, a scheduled time, Posted or Failed.',
    icon: LayoutGrid,
  },
  {
    anchor: 'month-nav',
    chapter: 'Your calendar',
    title: 'Move between months',
    body: 'Use the arrows to go back or ahead a month. When you’re on another month, the middle button reads “Back to today” and brings you home.',
    tip: 'Type in “Jump to…” beside it, like “Dec” or “2027”, to go straight there.',
    icon: ArrowLeftRight,
  },
  {
    anchor: 'unsent-tray',
    chapter: 'Your calendar',
    title: 'Not sent yet',
    body: 'Drafts and ideas that haven’t gone out, sorted by what needs you: Overdue first, then This week, then Later.',
    points: ['Drag any card onto a day to move it', 'Kawayan asks before moving, and you can undo', 'Scheduled and posted items stay put'],
    tip: 'On a phone or tablet, press and hold a card to drag it.',
    icon: Inbox,
  },
  {
    anchor: 'up-next',
    chapter: 'Your calendar',
    title: 'What needs you next',
    body: 'Today’s post, drafts to review this week, and anything that failed to publish. Click one to open it.',
    icon: Sun,
  },

  // ── Create ──
  {
    anchor: 'plan-month',
    chapter: 'Create',
    title: 'Plan a whole month at once',
    body: 'The fastest way to fill your calendar.',
    points: ['Choose how many posts, like “2 a week”', 'Add a focus, such as a promo or a new product', 'Kawayan suggests one idea per day; edit them, then approve to turn them into drafts'],
    tip: 'Near the end of a month, it offers to plan next month instead.',
    icon: Layers,
  },
  {
    anchor: 'create-post',
    chapter: 'Create',
    title: 'Write one post',
    body: 'Opens the post studio, three steps from idea to scheduled post.',
    points: ['Idea: say what the post is about', 'Caption: Taglish, with quick fixes like Shorter or More playful, and a reach score', 'Image: made to match, or upload your own photo'],
    tip: 'Pick Facebook, Instagram or both, and a time. “Best” marks when Filipino audiences are most online.',
    icon: PenLine,
  },

  // ── Stay on top ──
  {
    anchor: 'notifications',
    chapter: 'Stay on top',
    title: 'Updates in one place',
    body: 'Posts that went out, posts that failed, and pages that need reconnecting all show up here.',
    icon: Bell,
  },
  {
    anchor: 'posts-used',
    chapter: 'Stay on top',
    title: 'Your posts this month',
    body: 'How many of your monthly posts you’ve used. It resets on the 1st. Free gives you 8 a month and Pro gives you 16; extra posts are ₱150 each.',
    icon: Gauge,
  },

  // ── Your account ──
  {
    anchor: 'nav-insights',
    chapter: 'Your account',
    title: 'See what’s working',
    body: 'Followers, reach and engagement against the period before, your best posts, and up to three posts side by side. Download your numbers any time.',
    icon: BarChart3,
  },
  {
    anchor: 'nav-social',
    chapter: 'Your account',
    title: 'Connect your pages',
    body: 'Link one Facebook Page and one Instagram Business or Creator account. After that, Kawayan posts for you at the times you pick.',
    icon: Share2,
  },
  {
    anchor: 'nav-billing',
    chapter: 'Your account',
    title: 'Plan and wallet',
    body: 'Upgrade to Pro, or top up your wallet with GCash, Maya or a card through PayMongo, for extra posts.',
    icon: CreditCard,
  },
  {
    anchor: 'nav-settings',
    chapter: 'Your account',
    title: 'Make it sound like you',
    body: 'Change your brand voice, audience and themes; Kawayan uses them in every caption. Light or dark mode lives here too, and so does this tour.',
    icon: SettingsIcon,
  },
  {
    anchor: 'help-button',
    chapter: 'Your account',
    title: 'Help is one click away',
    body: 'Ask the AI assistant, send a ticket, or request a call with a real person.',
    tip: 'Press ⌘K (Ctrl+K on Windows) from anywhere.',
    icon: MessageSquare,
  },

  {
    anchor: null,
    chapter: 'Done',
    title: 'You’re all set',
    body: 'The best first step is planning your month: pick how many posts, and Kawayan drafts them in your voice.',
    tip: 'Replay this tour any time from Settings.',
    icon: Rocket,
  },
];
