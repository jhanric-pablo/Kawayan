/**
 * Terms of Service and Privacy Policy, shown at /terms and /privacy.
 * Numbers here (post limits, prices, rewrites) must match src/utils/tierLimits.ts and the post studio.
 * Bump TOS_VERSION on any material change: sign-up stores the version each person agreed to.
 */
import { ADDON_POST_PRICE_PHP, PRO_POST_LIMIT, PRO_PRICE_PHP, TRIAL_POST_LIMIT } from '../utils/tierLimits';

export const TOS_VERSION = '2.0';
export const LEGAL_UPDATED = 'October 30, 2026';

export interface LegalSection {
  id: string;
  title: string;
  /** One or two plain sentences, shown beside the full text. */
  summary: string;
  body: string[];
}

export type LegalDocId = 'terms' | 'privacy';

export const LEGAL_DOCS: Record<LegalDocId, { title: string; intro: string; highlights: string[]; sections: LegalSection[] }> = {
  terms: {
    title: 'Terms of Service',
    intro: 'The agreement between you and Kawayan AI when you use the platform. Each section has a plain-language summary, but the full text is what counts.',
    highlights: [
      'Kawayan helps you plan, write and publish posts. You stay responsible for what goes out on your pages.',
      'Your business permit is checked by a person before the full app opens up.',
      `Free gives you ${TRIAL_POST_LIMIT} posts a month. Pro gives you ${PRO_POST_LIMIT} for ₱${PRO_PRICE_PHP} a month.`,
      'You can connect one Facebook Page and one Instagram account, and disconnect them any time.',
    ],
    sections: [
      {
        id: 'about',
        title: 'What Kawayan does',
        summary: 'A tool for Philippine small businesses to plan, write and publish social posts.',
        body: [
          'Kawayan AI ("Kawayan", "we") is a web app that helps micro, small and medium businesses in the Philippines plan a month of social media content, draft captions and images with AI, and publish or schedule them to Facebook and Instagram.',
          'By creating an account or using Kawayan, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the service.',
        ],
      },
      {
        id: 'account',
        title: 'Your account',
        summary: 'Use real details, keep your password to yourself, and tell us if something looks wrong.',
        body: [
          'You must be at least 18 years old and either own the business you register or be authorized to act for it. The details you give us (email, business name, address and contact number) must be true and kept up to date.',
          'You are responsible for everything done through your account. Keep your password private and contact us through Help and support right away if you think someone else has used it.',
        ],
      },
      {
        id: 'verification',
        title: 'Business verification',
        summary: 'A person checks your permit. Approval is not a government endorsement.',
        body: [
          "To unlock the calendar, AI writing and publishing, you upload a business document such as a Mayor's Permit, DTI registration or SEC registration. Our team reviews it by hand.",
          'We do not check your document against government databases. Approval only means our team reviewed what you uploaded. We may reject or later revoke verification if a document turns out to be fake, expired or not yours.',
        ],
      },
      {
        id: 'plans',
        title: 'Plans and limits',
        summary: `Free: ${TRIAL_POST_LIMIT} posts a month. Pro: ${PRO_POST_LIMIT} posts for ₱${PRO_PRICE_PHP}. Each post can be fully rewritten twice.`,
        body: [
          `Free accounts can create up to ${TRIAL_POST_LIMIT} posts per calendar month. Pro costs ₱${PRO_PRICE_PHP} a month and allows up to ${PRO_POST_LIMIT}. Extra posts beyond your limit cost ₱${ADDON_POST_PRICE_PHP} each, paid from your wallet.`,
          'Each post can be fully rewritten by the AI up to two times. Limits reset at the start of each calendar month. We may change plans and prices, and we will show any change in the app before it applies to you.',
        ],
      },
      {
        id: 'payments',
        title: 'Payments and wallet',
        summary: 'Payments go through PayMongo, in pesos. Top-ups are generally not refundable.',
        body: [
          'Payments are handled by PayMongo (for example GCash, Maya and cards). Prices are in Philippine pesos and shown before you pay. We never see or store your full card details.',
          'Wallet top-ups and plan payments are not refundable, except where the law requires it or where you were charged by mistake. If a payment looks wrong, contact us through Help and support and we will look into it.',
        ],
      },
      {
        id: 'pages',
        title: 'Connected Facebook and Instagram',
        summary: 'You let Kawayan post to the pages you connect. Meta’s own rules still apply.',
        body: [
          'You can connect one Facebook Page and one Instagram Business or Creator account. You must have the right to manage them. When you press Post now or Schedule, you authorize Kawayan to publish that post to those pages for you. We use Zernio, a publishing service, to do this.',
          'Facebook and Instagram are run by Meta, and their terms and community standards apply to everything you post. We are not responsible if Meta limits, removes or delays a post, or changes how its platforms work. You can disconnect a page at any time from Social accounts.',
        ],
      },
      {
        id: 'content',
        title: 'AI drafts and your content',
        summary: 'The AI can make mistakes. Read every post before it goes out. What you publish is yours.',
        body: [
          'Kawayan uses AI to suggest content plans, captions and images. AI output can be wrong, outdated or unsuitable for your business. Always review and edit a post before you publish or schedule it.',
          'You own the content you create and publish with Kawayan. You give us permission to store, process and display it only as needed to run the service for you. We do not promise any level of reach, engagement or sales.',
        ],
      },
      {
        id: 'conduct',
        title: 'What you may not do',
        summary: 'No fake permits, spam, illegal or misleading posts, or attempts to break the system.',
        body: [
          'You may not: upload fake or someone else’s business documents; publish content that is illegal, misleading, defamatory, hateful or that infringes someone else’s rights; send spam; impersonate another person or business; try to get around plan limits; scrape, reverse-engineer or overload the service; or harass our staff or other users.',
        ],
      },
      {
        id: 'closing',
        title: 'Suspension and closing your account',
        summary: 'We can suspend accounts that break these Terms. You can ask us to close yours at any time.',
        body: [
          'We may suspend or close an account that breaks these Terms, fails verification, or is involved in payment fraud. Where we can, we will tell you why first.',
          'You can ask to close your account through Help and support. What happens to your data afterwards is explained in the Privacy Policy.',
        ],
      },
      {
        id: 'liability',
        title: 'Disclaimers and liability',
        summary: 'We work hard to keep Kawayan running, but cannot promise it never goes down.',
        body: [
          'Kawayan is provided "as is". The service depends on outside providers (including Meta, PayMongo and our AI provider), and outages on their side can affect it. We do not guarantee the service will be uninterrupted or error-free.',
          'As far as the law allows, our total liability to you for any claim is limited to the amount you paid Kawayan in the 12 months before the claim.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to these Terms',
        summary: 'If we change something important, we will tell you in the app first.',
        body: [
          'We may update these Terms when the service or the law changes. For important changes we will notify you in the app before they take effect. The date at the top shows the latest version. If you keep using Kawayan after a change, you accept the updated Terms.',
        ],
      },
      {
        id: 'law',
        title: 'Governing law and contact',
        summary: 'Philippine law applies. Questions go to Help and support.',
        body: [
          'These Terms are governed by the laws of the Republic of the Philippines.',
          'Questions about these Terms can be sent through Help and support inside the app.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: 'What personal data Kawayan collects, why, who else handles it, and the rights you have under the Data Privacy Act of 2012 (Republic Act No. 10173).',
    highlights: [
      'We collect what we need to run your account, check your business and publish your posts.',
      'We do not sell your data and do not show you ads.',
      'Your permit is seen only by the staff who review it.',
      'You can ask to see, correct or delete your data at any time.',
    ],
    sections: [
      {
        id: 'collect',
        title: 'What we collect',
        summary: 'Your account and business details, your brand profile, your posts, and basic records of payments and support.',
        body: [
          'Account: your email address and password. We store only a scrambled (hashed) version of the password, never the password itself.',
          "Business: your business name, address, contact number and the business document you upload for verification (for example a Mayor's Permit or DTI registration).",
          'Brand profile and content: your industry, audience, brand voice, themes and colours, plus the plans, captions, images and schedules you create.',
          'Connected pages: the name, username and account IDs of the Facebook Page and Instagram account you connect, and the results Meta reports for posts published through Kawayan (such as reach and likes). We never receive your Facebook or Instagram password.',
          'Payments and support: top-up and plan payment records from PayMongo (amount, status and reference), and the messages you send our support team.',
        ],
      },
      {
        id: 'use',
        title: 'How we use it',
        summary: 'To run your account, verify your business, write and publish your posts, and handle payments and support.',
        body: [
          'We use your data to create and secure your account, review your verification document, write content plans and captions, publish posts you approve, show your post results, process payments and answer support requests.',
          'We do not sell your personal data, and we do not use it for advertising.',
        ],
      },
      {
        id: 'share',
        title: 'Who else handles your data',
        summary: 'A few trusted providers that make Kawayan work, and authorities only when the law requires it.',
        body: [
          'Supabase stores our database and uploaded files. Cloudflare Workers AI writes captions and images. Zernio publishes posts to Facebook and Instagram, and Meta receives the posts you publish. PayMongo processes payments. Resend sends account emails such as password resets.',
          'Each of them gets only what it needs for its job. We may also share data when the law, a court order or a government authority requires it.',
        ],
      },
      {
        id: 'ai',
        title: 'What the AI sees',
        summary: 'Only your brand profile and the post topic. Never your permit, contact details or payment info.',
        body: [
          'To write a post, we send your business name, industry, audience, brand voice, themes and the post topic to our AI provider. We do not send your verification document, contact details or payment information.',
          'AI results are saved to your account so you can edit and reuse them.',
        ],
      },
      {
        id: 'keep',
        title: 'How long we keep it',
        summary: 'While your account is open, plus what the law requires us to keep for billing and audits.',
        body: [
          'We keep your data while your account is active. When you close your account, we delete or anonymize your personal data, except records we must keep for billing, tax, audit or legal reasons. We keep those only as long as required.',
        ],
      },
      {
        id: 'rights',
        title: 'Your rights',
        summary: 'You can see, correct, download or delete your data, and complain to the National Privacy Commission.',
        body: [
          'Under the Data Privacy Act of 2012 you have the right to be informed, to access your data, to correct it, to object to its processing, to have it erased or blocked, to receive a copy in a portable format, and to claim damages.',
          'You can edit your business and brand details in Settings and disconnect pages in Social accounts. For anything else, contact us through Help and support. If you are not satisfied with our answer, you can file a complaint with the National Privacy Commission at privacy.gov.ph.',
        ],
      },
      {
        id: 'security',
        title: 'Security',
        summary: 'Hashed passwords, staff access by role, and a log of sensitive staff actions.',
        body: [
          'Passwords are hashed. Staff can see only what their role needs. Sensitive actions, such as approving a verification, are recorded in an audit log. No online service is perfectly secure, but we will tell you and the National Privacy Commission if a breach puts your data at real risk, as the law requires.',
        ],
      },
      {
        id: 'browser',
        title: 'Cookies and your browser',
        summary: 'We save your sign-in and display settings in your browser. No ad trackers.',
        body: [
          'Kawayan saves your sign-in session and preferences (such as dark mode and accessibility settings) in your browser’s local storage so you stay signed in and the app looks the way you left it. We do not use advertising or tracking cookies.',
        ],
      },
      {
        id: 'updates',
        title: 'Changes and contact',
        summary: 'We will tell you in the app about important changes. Privacy questions go to Help and support.',
        body: [
          'Kawayan is not meant for anyone under 18. We may update this policy when the service or the law changes, and we will notify you in the app about important changes.',
          'For privacy questions or requests, contact us through Help and support inside the app.',
        ],
      },
    ],
  },
};
