import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// Exclusão da própria conta (LGPD). Apaga o login; o banco apaga o resto em cascata.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'entre na sua conta' }, { status: 401 });
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from('avatars').list(user.id);
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
