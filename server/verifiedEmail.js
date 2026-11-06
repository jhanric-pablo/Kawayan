// "Bamboo milestone" email sent when an admin approves a business verification.
// Tables + inline styles so it renders in Gmail, Outlook and phone mail apps; logo as PNG (Gmail blocks SVG).

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Today in Manila, plus the next payday (15th or last day of the month).
function manilaDates(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(now).map((p) => [p.type, Number(p.value)]),
  );
  const { year, month, day } = parts;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const payDay = day <= 15 ? 15 : last;
  const fmt = (d) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, d)));
  return { today: fmt(day), payday: payDay === day ? null : fmt(payDay) };
}

export function verifiedEmail({ businessName, appUrl, now = new Date() }) {
  const name = esc(businessName || 'Your business');
  const url = (appUrl || 'https://kawayan-ai.onrender.com').replace(/\/$/, '');
  const { today, payday } = manilaDates(now);
  const paydayLine = payday
    ? `Payday is on <b>${payday}</b>. Plan your month now and Kawayan will put a promo post right on it.`
    : 'Payday is <b>today</b>. Plan your month now and catch the next one with a promo post.';
  const font = "Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

  const subject = 'Tumutubo na! Your bamboo just grew';
  const preheader = `${businessName || 'Your business'} is verified. One step left before your first post.`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f7f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbfcf9;border:1px solid #e4e4e7;border-radius:14px;font-family:${font};color:#0a0a0a;">
  <tr><td style="padding:28px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${url}/brand/kawayan-icon-512.png" width="32" height="32" alt="Kawayan" style="display:block;border-radius:8px;"></td><td style="padding-left:9px;font-size:17px;font-weight:700;letter-spacing:-0.5px;">Kawayan</td></tr></table></td>
      <td align="right" style="font-size:12px;color:#6b6b73;font-family:'Geist Mono',Menlo,monospace;">MILESTONE 2 OF 3</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:26px 32px 0;">
    <h1 style="margin:0;font-size:30px;line-height:1.1;letter-spacing:-1px;font-weight:700;">Tumutubo na! <span style="color:#0b7a4e;">Your bamboo just grew.</span></h1>
    <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:#3f3f46;">Hi! ${name} is verified. One joint left before your first post goes out.</p>
  </td></tr>
  <tr><td style="padding:26px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48" style="vertical-align:bottom;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td style="padding:0 0 4px 12px;font-size:20px;line-height:1;color:#7ccb4f;">&#10022;</td></tr>
          <tr><td style="width:22px;height:46px;background:#e4ece6;border:2px dashed #b9cfc0;border-radius:4px;"></td></tr>
          <tr><td style="height:5px;"></td></tr>
          <tr><td style="width:22px;height:46px;background:#3aa655;border-radius:4px;"></td></tr>
          <tr><td style="height:5px;"></td></tr>
          <tr><td style="width:22px;height:46px;background:#155d33;border-radius:4px;"></td></tr>
        </table>
      </td>
      <td style="padding-left:16px;vertical-align:bottom;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.45;">
          <tr><td style="height:56px;vertical-align:middle;border-bottom:1px dashed #d4d4d8;"><b style="color:#6b6b73;">3 · Your first post</b><br><span style="color:#8b8b93;font-size:13px;">Plan your month and approve a post</span></td><td align="right" style="border-bottom:1px dashed #d4d4d8;"><span style="padding:3px 9px;border-radius:999px;border:1px dashed #a1a1aa;font-size:12px;color:#6b6b73;white-space:nowrap;">Next</span></td></tr>
          <tr><td style="height:51px;vertical-align:middle;border-bottom:1px dashed #d4d4d8;"><b>2 · Business verified</b><br><span style="color:#6b6b73;font-size:13px;">${today} · checked by a person on our team</span></td><td align="right" style="border-bottom:1px dashed #d4d4d8;"><span style="padding:3px 9px;border-radius:999px;background:#e6f3ec;color:#0a5c3b;font-size:12px;font-weight:600;white-space:nowrap;">Done today</span></td></tr>
          <tr><td style="height:51px;vertical-align:middle;"><b>1 · Account created</b><br><span style="color:#6b6b73;font-size:13px;">Brand DNA saved</span></td><td align="right"><span style="padding:3px 9px;border-radius:999px;background:#e6f3ec;color:#0a5c3b;font-size:12px;font-weight:600;white-space:nowrap;">Done</span></td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f2b1c;border-radius:12px;"><tr><td style="padding:20px 22px;color:#ffffff;">
      <p style="margin:0;font-size:12px;color:#a6e07a;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Good timing</p>
      <p style="margin:6px 0 0;font-size:16px;line-height:1.5;color:#ffffff;">${paydayLine}</p>
      <p style="margin:16px 0 0;"><a href="${url}/" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a6e07a;color:#0f2b1c;font-size:15px;font-weight:700;text-decoration:none;">Tara, simulan na natin &rarr;</a></p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px 30px;font-size:14px;line-height:1.6;color:#6b6b73;">
    Need help connecting your Page? Reply here or open the Help desk. We usually answer within a few hours.<br><br><b style="color:#0a0a0a;">The Kawayan team</b>
  </td></tr>
</table>
<p style="margin:16px 0 0;font-family:${font};font-size:12px;line-height:1.6;color:#8b8b93;text-align:center;">Kawayan · kaway (to wave hello) + kawayan (bamboo)<br>You're getting this because your business was verified on Kawayan.</p>
</td></tr></table>
</body></html>`;

  const text = [
    'Tumutubo na! Your bamboo just grew.',
    '',
    `Hi! ${businessName || 'Your business'} is verified. One step left before your first post goes out.`,
    '',
    '1. Account created (done)',
    `2. Business verified (done today, ${today})`,
    '3. Your first post (next): plan your month and approve a post',
    '',
    payday ? `Payday is on ${payday}. Plan your month now and Kawayan will put a promo post right on it.` : 'Payday is today. Plan your month now and catch the next one with a promo post.',
    '',
    `Start here: ${url}/`,
    '',
    'Need help connecting your Page? Reply here or open the Help desk.',
    'The Kawayan team',
  ].join('\n');

  return { subject, html, text };
}
