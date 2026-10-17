// Entrega das notificações: no celular/navegador (Web Push) e por e-mail para quem ativou.
import webpush from 'web-push';
import nodemailer from 'nodemailer';

const SITE = process.env.SITE_URL || 'https://musika.tech';
const PUBLIC_SB = process.env.PUBLIC_SUPABASE_URL || '';
const BRAND = process.env.BRAND_NAME || 'Paredão Play';
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
// imagem do aviso: caminho no bucket de capas ou endereço completo (imagem enviada pelo admin)
const image = (path) => (!path ? null : /^https?:\/\//.test(path) ? path : PUBLIC_SB ? `${PUBLIC_SB}/storage/v1/object/public/covers/${path}` : null);

// o que cada tipo de aviso mostra
const KIND = {
  lancamento: { tag: 'Lançamento novo', cta: 'Ouvir agora', action: 'Ouvir agora' },
  show: { tag: 'Show marcado', cta: 'Ver agenda', action: 'Ver show' },
  lembrete: { tag: 'É amanhã', cta: 'Ver detalhes', action: 'Ver show' },
  post: { tag: 'Mural do artista', cta: 'Ver post', action: 'Ver post' },
  insignia: { tag: 'Conquista', cta: 'Ver minhas insígnias', action: 'Ver' },
  nivel: { tag: 'Subiu de nível', cta: 'Ver meu perfil', action: 'Ver' },
  aviso: { tag: 'Novidade', cta: 'Abrir', action: 'Abrir' },
};
const kindLabel = { cd: 'CD', single: 'Single', ao_vivo: 'Ao vivo' };

function emailHtml(n) {
  const k = KIND[n.kind] || KIND.aviso;
  const img = image(n.image_path);
  const rel = n.release;
  const cta = rel ? 'Ouvir agora' : k.cta;
  const pre = n.body || n.title;
  const tracks = rel?.tracks?.length
    ? `<tr><td style="padding:4px 32px 8px">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #26262F">
         ${rel.tracks.map((t, i) => `<tr><td style="padding:11px 0;border-bottom:1px solid #26262F;font-size:15px;color:#F5F5F5"><span style="display:inline-block;width:26px;color:#9C9CA8">${i + 1}</span>${esc(t)}</td></tr>`).join('')}
         </table></td></tr>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${esc(n.title)}</title></head>
<body style="margin:0;padding:0;background:#0B0B0F;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre).slice(0, 140)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0F"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><a href="${SITE}"><img src="${SITE}/email/logo.png" width="237" height="60" alt="${esc(BRAND)}" style="display:block;border:0"></a></td></tr>
<tr><td style="background:#16161D;border:1px solid #26262F;border-radius:22px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${img ? `<tr><td style="padding:0"><a href="${esc(abs(n.link))}"><img src="${esc(img)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:22px 22px 0 0"></a></td></tr>` : ''}
<tr><td style="padding:28px 32px 0"><span style="display:inline-block;background:#FF2D55;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:999px">${esc(rel ? `Novo ${kindLabel[rel.kind] || 'CD'}` : k.tag)}</span></td></tr>
${n.name ? `<tr><td style="padding:18px 32px 0;font-size:15px;color:#9C9CA8">Oi, ${esc(n.name)}!</td></tr>` : ''}
<tr><td style="padding:10px 32px 0;font-size:28px;line-height:1.15;font-weight:800;color:#FFFFFF">${esc(n.title)}</td></tr>
${rel ? `<tr><td style="padding:8px 32px 0;font-size:16px;color:#B4B4C0">${esc(rel.artist)} · ${esc(rel.title)}</td></tr>` : ''}
${n.body ? `<tr><td style="padding:14px 32px 6px;font-size:16px;line-height:1.55;color:#C9C9D2">${esc(n.body)}</td></tr>` : ''}
${tracks}
<tr><td style="padding:22px 32px 32px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#FF2D55">
  <a href="${esc(abs(n.link))}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">&#9654;&nbsp; ${esc(cta)}</a>
  </td></tr></table>
</td></tr>
</table></td></tr>
<tr><td style="padding:22px 8px 0;font-size:12px;line-height:1.6;color:#9C9CA8;text-align:center">
${esc(BRAND)}. Sua música, sem limites.<br>
Você recebe este e-mail porque ativou avisos por e-mail. <a href="${SITE}/conta#notificacoes" style="color:#FF2D55">Escolher o que receber</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendPush(sb, n) {
  const k = KIND[n.kind] || KIND.aviso;
  const img = image(n.image_path);
  const payload = JSON.stringify({
    title: n.title,
    body: n.body || (n.release ? `${n.release.artist} · ${n.release.title}` : ''),
    url: abs(n.link),
    icon: img || `${SITE}/icon-192.png`,
    image: img || undefined,
    tag: `${n.kind}-${n.id}`,
    actions: n.link ? [{ action: 'abrir', title: n.release ? 'Ouvir agora' : k.action }] : [],
  });
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
    const text = [n.name ? `Oi, ${n.name}!` : '', n.title, n.release ? `${n.release.artist} · ${n.release.title}` : '', n.body || '', ...(n.release?.tracks || []).map((t, i) => `${i + 1}. ${t}`), '', abs(n.link)].filter((l) => l !== null).join('\n');
    await mailer.sendMail({ from: `${BRAND} <${SMTP_FROM}>`, to: n.email, subject: n.title, html: emailHtml(n), text, headers: { 'List-Unsubscribe': `<${SITE}/conta#notificacoes>` } });
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

// para pré-visualizar o e-mail sem enviar
export { emailHtml };
