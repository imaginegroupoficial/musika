import { NextResponse } from 'next/server';
import { createAdminClient, getSessionProfile } from '@/lib/supabase/server';

// Ações do admin sobre uma conta. As regras ficam no banco (funções admin_*);
// aqui só entra o que precisa da chave de serviço: travar o login e excluir a conta.
export async function POST(req: Request) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user || !profile?.is_admin) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; user?: string; days?: number; note?: string; on?: boolean; reason?: string };
  const id = String(body.user || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'usuário inválido' }, { status: 400 });
  const admin = createAdminClient();
  const fail = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

  switch (body.action) {
    case 'premium': {
      const { data, error } = await supabase.rpc('admin_set_premium', { p_user: id, p_days: Math.round(Number(body.days) || 0), p_note: body.note || null });
      return error ? fail(error.message) : NextResponse.json({ ok: true, until: data });
    }
    case 'admin': {
      const { error } = await supabase.rpc('admin_set_admin', { p_user: id, p_on: !!body.on });
      return error ? fail(error.message) : NextResponse.json({ ok: true });
    }
    case 'block': {
      const { error } = await supabase.rpc('admin_set_blocked', { p_user: id, p_block: !!body.on, p_reason: body.reason || null });
      if (error) return fail(error.message);
      // trava (ou libera) o login no Supabase Auth; quem já estava logado perde a sessão na próxima renovação
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { ban_duration: body.on ? '876000h' : 'none' });
      return e2 ? fail(`bloqueio salvo, mas o login não foi travado: ${e2.message}`, 500) : NextResponse.json({ ok: true });
    }
    case 'delete': {
      if (id === user.id) return fail('você não pode excluir a sua própria conta por aqui');
      await admin.from('admin_log').insert({ admin_id: user.id, user_id: id, action: 'conta_excluida' });
      const { data: files } = await admin.storage.from('avatars').list(id);
      if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${id}/${f.name}`));
      const { error } = await admin.auth.admin.deleteUser(id);
      return error ? fail(error.message, 500) : NextResponse.json({ ok: true });
    }
    default:
      return fail('ação desconhecida');
  }
}
