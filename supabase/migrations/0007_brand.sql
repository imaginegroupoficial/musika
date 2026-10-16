-- Musika: aparência configurável, textos editáveis e banners da casa

insert into public.settings (key, value) values
  ('theme', '{"preset": "cartaz"}'),
  ('texts', '{}'),
  ('brand', '{"name": "Musika", "logo_path": null}')
on conflict (key) do nothing;

-- Banners da casa: aparecem no topo da página inicial e no lugar dos anúncios quando não há campanha rodando
create table if not exists public.house_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cta text,
  image_path text,
  link_url text check (link_url is null or link_url ~ '^(https?://|/)'),
  placement text not null default 'carrossel' check (placement in ('carrossel', 'faixa')),
  position integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists house_banners_active on public.house_banners (placement, active, position);

alter table public.house_banners enable row level security;
drop policy if exists house_banners_read on public.house_banners;
create policy house_banners_read on public.house_banners for select using (
  (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin()
);
drop policy if exists house_banners_write on public.house_banners;
create policy house_banners_write on public.house_banners for all using (public.is_admin()) with check (public.is_admin());

grant select on public.house_banners to anon, authenticated;
grant insert, update, delete on public.house_banners to authenticated;
grant all on public.house_banners to service_role;

-- admin_set_setting passa a criar a chave se ela ainda não existir
create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  insert into public.settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke execute on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;
