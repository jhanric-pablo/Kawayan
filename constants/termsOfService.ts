/** Terms of Service — aligned with Grp7 Capstone paper (Kawayan AI, PUP Parañaque) */
export const TOS_VERSION = '1.0';
export const TOS_EFFECTIVE_DATE = 'June 2025';

export const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating a Kawayan AI account, you confirm that you have read, understood, and agree to these Terms of Service and our Privacy Policy. Kawayan AI is an intelligent content generation and scheduling platform designed for Philippine Micro, Small, and Medium Enterprises (MSMEs). If you do not agree, you may not register or use the service.`,
  },
  {
    title: '2. Eligibility & Business Registration',
    body: `The platform is intended for legitimate MSME owners or authorized representatives in the Philippines. You must provide accurate business information (name, address, contact number, and email). You agree to upload a valid business registration document (Mayor's Permit, DTI, or SEC Registration) for verification. Access to core features (AI content generation, calendar, and analytics) is granted only after administrator approval of your verification submission.`,
  },
  {
    title: '3. Account Security & RBAC',
    body: `You are responsible for safeguarding your login credentials. Kawayan AI uses Role-Based Access Control (RBAC). You may not share admin or support credentials, attempt unauthorized access, or use another user's account. You must notify us immediately if you suspect unauthorized use of your account.`,
  },
  {
    title: '4. Subscription Plans & Fair Use',
    body: `Kawayan AI operates as Software-as-a-Service (SaaS) with tiered usage: Free Trial (8 posts per calendar month) and Pro (16 posts per calendar month). Supplemental add-on posts may be purchased separately. Regeneration of AI captions and images is limited to two attempts per post to prevent resource abuse. We reserve the right to enforce tier limits and suspend accounts that circumvent usage caps.`,
  },
  {
    title: '5. Payments & Wallet (Xendit)',
    body: `Paid features are processed through our prepaid wallet and Xendit payment gateway (GCash, Maya, cards, and other supported channels). All amounts are in Philippine Peso (PHP). Wallet top-ups and subscription charges are non-refundable except where required by law. You agree that payment verification may require manual or automated confirmation before credits are applied.`,
  },
  {
    title: '6. AI-Generated Content',
    body: `Content (captions, images, schedules) is generated with AI assistance, including culturally localized Taglish output. You retain responsibility for reviewing, editing, and approving all content before publication. Kawayan AI does not guarantee viral performance, engagement outcomes, or platform compliance. You agree not to publish unlawful, misleading, defamatory, or infringing material.`,
  },
  {
    title: '7. Business Verification Limitations',
    body: `As stated in our system scope, business verification is based on manual review of uploaded documents. We do not connect to government databases (DTI, SEC, or LGU systems). Approval indicates document review only—not a government endorsement of your business.`,
  },
  {
    title: '8. Data & Privacy',
    body: `We collect business profile data, generated content, wallet transactions, and support communications to operate the platform. Social platform metrics may be synced via our browser extension when you authorize it. See our Privacy Policy for data handling, retention, and your rights. By registering, you consent to processing necessary for account management, verification, billing, and service delivery.`,
  },
  {
    title: '9. Platform Limitations',
    body: `Kawayan AI is a web-based application. Reliable internet connectivity is required for AI generation and scheduling. The system does not include native mobile apps, automated video creation, or guaranteed direct publishing to social networks without extension-assisted workflows. Service availability may vary during maintenance or third-party API outages.`,
  },
  {
    title: '10. Prohibited Conduct',
    body: `You may not: (a) upload fraudulent verification documents; (b) abuse AI regeneration or batch generation to overload the system; (c) reverse-engineer or scrape the platform; (d) use the service for spam or illegal marketing; (e) harass support staff or other users.`,
  },
  {
    title: '11. Termination',
    body: `We may suspend or terminate accounts for violation of these terms, failed verification, payment fraud, or abusive behavior. You may request account closure through support. Upon termination, access to generated content and wallet balance handling will follow our retention and refund policies.`,
  },
  {
    title: '12. Disclaimer & Limitation of Liability',
    body: `Kawayan AI is provided "as is" for capstone and pilot deployment purposes. To the fullest extent permitted by law, we disclaim warranties of uninterrupted service or specific business results. Our liability is limited to the amount you paid to Kawayan AI in the twelve (12) months preceding any claim.`,
  },
  {
    title: '13. Changes to Terms',
    body: `We may update these Terms to reflect system changes or legal requirements. Material changes will be communicated through the platform. Continued use after updates constitutes acceptance of the revised Terms.`,
  },
  {
    title: '14. Governing Law',
    body: `These Terms are governed by the laws of the Republic of the Philippines. Disputes shall be subject to the jurisdiction of courts in Parañaque City, where the capstone pilot is conducted, unless otherwise required by applicable law.`,
  },
  {
    title: '15. Contact',
    body: `For questions about these Terms, contact Kawayan AI Support through the in-app Help Desk or your designated capstone support channel.`,
  },
] as const;
