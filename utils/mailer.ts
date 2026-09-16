import { logger } from './logger';

// Sends through Resend's HTTPS API (resend.com), not SMTP — outbound SMTP
// (ports 25/465/587) is blocked on Render's free plan and similar hosts,
// which silently hangs a raw SMTP connection instead of failing fast.
// Returns false (and logs) when RESEND_API_KEY is unset, so a dev without
// creds still works off the reset link the caller logs / echoes.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('sendEmail skipped: RESEND_API_KEY not set', { to, subject });
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Kawayan <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      logger.error('sendEmail error', { to, status: res.status, body: await res.text() });
      return false;
    }
    return true;
  } catch (error: any) {
    logger.error('sendEmail error', { to, error: error.message });
    return false;
  }
}
