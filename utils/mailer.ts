import nodemailer from 'nodemailer';
import { logger } from './logger';

// Sends through Gmail SMTP. Needs a Google account with 2-Step Verification
// enabled and an App Password (myaccount.google.com -> Security -> App passwords).
// Returns false (and logs) when GMAIL_USER / GMAIL_APP_PASSWORD are unset, so a
// dev without creds still works off the reset link the caller logs / echoes.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    logger.warn('sendEmail skipped: GMAIL_USER / GMAIL_APP_PASSWORD not set', { to, subject });
    return false;
  }

  try {
    await tx.sendMail({
      from: process.env.MAIL_FROM || `Kawayan <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error: any) {
    logger.error('sendEmail error', { to, error: error.message });
    return false;
  }
}
