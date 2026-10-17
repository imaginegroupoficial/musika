// Entrega das notificações: no celular/navegador (Web Push) e por e-mail para quem ativou.
import webpush from 'web-push';
import nodemailer from 'nodemailer';

const SITE = process.env.SITE_URL || 'https://musika.tech';
const PUBLIC_SB = process.env.PUBLIC_SUPABASE_URL || '';
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const pushOn = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushOn) webpush.setVapidDetails(VAPID_SUBJECT || `mailto:contato@${new URL(SITE).hostname}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const mailer = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: Number(SMTP_PORT || 465) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 2,
      rateDelta: 1000,
      rateLimit: 5,
    })
  : null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const abs = (link) => (link ? (link.startsWith('http') ? link : SITE + link) : SITE);
const cover = (path) => (path && PUBLIC_SB ? `${PUBLIC_SB}/storage/v1/object/public/covers/${path}` : null);

function emailHtml(n) {
  const img = cover(n.image_path);
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0B0B0F;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#16161D;border:1px solid #26262F;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 28px 0"><img src="${SITE}/email/logo.png" width="237" height="60" alt="Paredão Play" style="display:block;border:0"></td></tr>
${img ? `<tr><td style="padding:28px 28px 0"><img src="${esc(img)}" width="200" height="200" alt="" style="display:block;border-radius:16px;width:200px;height:200px;object-fit:cover"></td></tr>` : ''}
<tr><td style="padding:24px 28px 8px;font-size:24px;line-height:1.2;font-weight:800">${esc(n.title)}</td></tr>
${n.body ? `<tr><td style="padding:0 28px 8px;font-size:16px;line-height:1.5;color:#B4B4C0">${esc(n.body)}</td></tr>` : ''}
<tr><td style="padding:20px 28px 32px"><a href="${esc(abs(n.link))}" style="display:inline-block;background:#FF2D55;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Abrir no Paredão Play</a></td></tr>
<tr><td style="padding:18px 28px;background:#0B0B0F;font-size:12px;color:#9C9CA8">Você recebe este e-mail porque ativou avisos por e-mail. Para parar, desligue em <a href="${SITE}/conta#notificacoes" style="color:#FF2D55">Minha conta</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendPush(sb, n) {
  const payload = JSON.stringify({ title: n.title, body: n.body || '', url: abs(n.link), icon: cover(n.image_path), tag: `${n.kind}-${n.id}` });
  for (const sub of n.subs || []) {
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: n.kind === 'lancamento' ? 'high' : 'normal' });
    } catch (err) {
      // inscrição vencida ou removida pelo navegador: apaga
      if (err.statusCode === 404 || err.statusCode === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      else console.error('push:', err.statusCode || '', err.body || err.message);
    }
  }
}

async function sendEmail(n) {
  try {
    await mailer.sendMail({ from: `Paredão Play <${SMTP_FROM}>`, to: n.email, subject: n.title, html: emailHtml(n), text: `${n.title}\n\n${n.body || ''}\n\n${abs(n.link)}` });
  } catch (err) {
    console.error('e-mail:', err.message);
  }
}

export async function deliverNotifications(sb) {
  const { data, error } = await sb.rpc('claim_notifications', { p_limit: 200 });
  if (error) { console.error('notificações:', error.message); return 0; }
  for (const n of data || []) {
    if (pushOn && n.want_push && n.subs?.length) await sendPush(sb, n);
    if (mailer && n.want_email && n.email) await sendEmail(n);
  }
  return (data || []).length;
}

export function notifyStatus() {
  return `notificações: push ${pushOn ? 'ligado' : 'desligado (sem chaves VAPID)'}, e-mail ${mailer ? 'ligado' : 'desligado (sem SMTP)'}`;
}
