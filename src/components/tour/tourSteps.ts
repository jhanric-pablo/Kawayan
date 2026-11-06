export interface TourStep {
  /** data-tour value of the element to spotlight; null centres the card. */
  anchor: string | null;
  /** Group shown above the title ("Your calendar"). */
  chapter: string;
  title: string;
  body: string;
  /** false: skipped on phones (< 768px), where the sidebar is a drawer. Default true. */
  phone?: boolean;
}

/**
 * The walkthrough, in the order someone would use Kawayan: the calendar, making posts,
 * keeping track, then the account pages. Every anchor is on the calendar screen or the app
 * frame around it, so the tour never changes pages. A step whose anchor isn't on screen
 * or isn't visible (collapsed sidebar, phone drawer) is skipped.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: null,
    chapter: 'Welcome',
    title: 'A quick look around',
    body: 'Two minutes to see where everything is. Use the arrow keys to move, and Esc to leave.',
  },

  // ── Your calendar ──
  {
    anchor: 'calendar-views',
    chapter: 'Your calendar',
    title: 'Three ways to see your month',
    body: 'Month shows each post as a picture, Timeline gives each page its own row, and List puts everything in date order.',
  },
  {
    anchor: 'calendar-grid',
    chapter: 'Your calendar',
    title: 'Your month at a glance',
    body: 'Click a post to see when it goes out and where. Click an empty day to write one for it.',
  },
  {
    anchor: 'month-nav',
    phone: false,
    chapter: 'Your calendar',
    title: 'Move between months',
    body: 'Use the arrows to go back or ahead a month, or type a month like “Dec” in Jump to.',
  },
  {
    anchor: 'up-next',
    phone: false,
    chapter: 'Your calendar',
    title: 'What needs your attention',
    body: 'Posts waiting for your approval, what’s coming up, and anything that failed. Click one to see just those posts.',
  },

  // ── Create ──
  {
    anchor: 'plan-month',
    chapter: 'Create',
    title: 'Plan a whole month at once',
    body: 'Pick how many posts you want and Kawayan suggests one idea per day. You edit them, then approve.',
  },
  {
    anchor: 'create-post',
    chapter: 'Create',
    title: 'Write one post',
    body: 'Say what the post is about, and Kawayan writes a Taglish caption and an image to match. Then pick the pages and a time.',
  },

  // ── Stay on top ──
  {
    anchor: 'notifications',
    chapter: 'Stay on top',
    title: 'Updates in one place',
    body: 'Posts that went out, posts that failed, and pages that need reconnecting show up here.',
  },
  {
    anchor: 'posts-used',
    phone: false,
    chapter: 'Stay on top',
    title: 'Your posts this month',
    body: 'Free gives you 8 posts a month and Pro gives you 16. The count resets on the 1st.',
  },

  // ── Your account ──
  {
    anchor: 'nav-insights',
    phone: false,
    chapter: 'Your account',
    title: 'See what’s working',
    body: 'Reach and engagement against the period before, and your best posts side by side.',
  },
  {
    anchor: 'nav-social',
    phone: false,
    chapter: 'Your account',
    title: 'Connect your pages',
    body: 'Link your Facebook Page and Instagram account, and Kawayan posts for you at the times you pick.',
  },
  {
    anchor: 'nav-billing',
    phone: false,
    chapter: 'Your account',
    title: 'Plan and wallet',
    body: 'Upgrade to Pro, or top up with GCash, Maya or a card for extra posts.',
  },
  {
    anchor: 'nav-settings',
    phone: false,
    chapter: 'Your account',
    title: 'Make it sound like you',
    body: 'Change your brand voice, audience and themes here. You can also replay this tour from Settings.',
  },
  {
    anchor: 'help-button',
    phone: false,
    chapter: 'Your account',
    title: 'Help is one click away',
    body: 'Ask the AI assistant, send a ticket, or request a call with a real person.',
  },

  {
    anchor: null,
    chapter: 'Done',
    title: 'You’re all set',
    body: 'A good first step is planning your month. Pick how many posts, and Kawayan drafts them in your voice.',
  },
];
