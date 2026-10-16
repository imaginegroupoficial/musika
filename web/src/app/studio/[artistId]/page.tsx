import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { formatCount, kindLabel, levelInfo } from '@/lib/media';
import { Cover } from '@/components/ReleaseCard';
import AutoRefresh from '@/components/studio/AutoRefresh';
import ArtistSettings from '@/components/studio/ArtistSettings';

export const metadata = { title: 'Painel do artista' };
export const revalidate = 0;

type Dash = {
  totals: { plays: number; completes: number; downloads: number; listeners: number; followers: number; plays_all_time: number };
  daily: { day: string; plays: number }[];
  hours: { hour: number; plays: number }[];
  top_tracks: { id: string; title: string; release_title: string; plays: number; completion_pct: number | null }[];
  sources: { source: string; plays: number }[];
  top_fans: { user_id: string; username: string; display_name: string | null; xp: number }[];
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  draft: { text: 'Rascunho', cls: 'bg-palco text-nevoa' },
  processing: { text: 'Convertendo', cls: 'bg-sol/20 text-sol' },
  ready: { text: 'Publicado', cls: 'bg-mandacaru/20 text-mandacaru' },
  error: { text: 'Erro', cls: 'bg-chita/20 text-chita' },
};

function DailyChart({ daily }: { daily: Dash['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.plays));
  const w = 720, h = 160, bw = w / Math.max(1, daily.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="w-full" role="img" aria-label="Plays por dia nos últimos 30 dias">
      {daily.map((d, i) => {
        const bh = (d.plays / max) * h;
        return (
          <g key={d.day}>
            <rect x={i * bw + 2} y={h - bh} width={Math.max(2, bw - 4)} height={Math.max(bh, 1)} rx={3} fill={i === daily.length - 1 ? '#FFC531' : '#E8336D'} opacity={i === daily.length - 1 ? 1 : 0.85}>
              <title>{`${new Date(d.day + 'T12:00:00').toLocaleDateString('pt-BR')}: ${d.plays} plays`}</title>
            </rect>
          </g>
        );
      })}
      <text x={0} y={h + 18} fill="#B9AEE0" fontSize="12">{daily[0] && new Date(daily[0].day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</text>
      <text x={w} y={h + 18} fill="#B9AEE0" fontSize="12" textAnchor="end">hoje</text>
      <text x={w} y={12} fill="#B9AEE0" fontSize="12" textAnchor="end">{max} plays</text>
    </svg>
  );
}

export default async function ArtistDashboard({ params }: { params: { artistId: string } }) {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/studio');
  const { data: member } = await supabase.from('artist_members').select('role').eq('artist_id', params.artistId).eq('user_id', user.id).maybeSingle();
  if (!member) notFound();

  const [{ data: artist }, { data: dash }, { data: releases }] = await Promise.all([
    supabase.from('artists').select('*').eq('id', params.artistId).single(),
    supabase.rpc('artist_dashboard', { p_artist: params.artistId, p_days: 30 }),
    supabase.from('releases').select('id, slug, title, kind, status, publish_at, cover_path, tracks(status)').eq('artist_id', params.artistId).order('created_at', { ascending: false }),
  ]);
  if (!artist) notFound();
  const d = dash as Dash;
  const rels = (releases || []) as { id: string; slug: string; title: string; kind: string; status: string; publish_at: string; cover_path: string | null; tracks: { status: string }[] }[];
  const processing = rels.some((r) => r.status === 'processing');
  const peakHour = [...(d.hours || [])].sort((a, b) => b.plays - a.plays)[0];
  const completion = d.totals.plays ? Math.round((d.totals.completes / d.totals.plays) * 100) : 0;

  const stats = [
    { label: 'Plays em 30 dias', value: formatCount(d.totals.plays) },
    { label: 'Ouvintes únicos', value: formatCount(d.totals.listeners) },
    { label: 'Ouviram até o fim', value: `${completion}%` },
    { label: 'Downloads', value: formatCount(d.totals.downloads) },
    { label: 'Seguidores', value: formatCount(d.totals.followers) },
  ];

  return (
    <>
      <AutoRefresh active={processing} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/${artist.slug}`} className="text-sm font-semibold text-nevoa hover:text-luar">musika.tech/{artist.slug}</Link>
          <h1 className="mt-1 font-display text-5xl font-extrabold tracking-tight md:text-6xl">{artist.name}</h1>
        </div>
        <Link href={`/studio/${artist.id}/lancamento`} className="inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">
          Publicar lançamento
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-nevoa">{s.label}</dt>
            <dd className="font-display text-4xl font-extrabold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 rounded-capa bg-lona p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold">Plays por dia</h2>
          {peakHour && <p className="text-sm text-nevoa">Seu público mais ouve por volta das {peakHour.hour}h. Lance e poste nesse horário.</p>}
        </div>
        <DailyChart daily={d.daily || []} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Faixas que mais tocaram</h2>
          {d.top_tracks.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-nevoa">
                <tr><th className="py-2 font-medium">Faixa</th><th className="py-2 text-right font-medium">Plays</th><th className="py-2 text-right font-medium">Até o fim</th></tr>
              </thead>
              <tbody className="divide-y divide-lona">
                {d.top_tracks.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5"><span className="block font-medium">{t.title}</span><span className="text-xs text-nevoa">{t.release_title}</span></td>
                    <td className="py-2.5 text-right tabular-nums">{formatCount(t.plays)}</td>
                    <td className={`py-2.5 text-right tabular-nums ${(t.completion_pct ?? 0) < 40 ? 'text-chita' : ''}`}>{t.completion_pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-nevoa">Os dados aparecem assim que alguém ouvir seu primeiro lançamento.</p>}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-bold">De onde vêm os plays</h2>
          {d.sources.length ? (
            <ul className="space-y-2">
              {d.sources.map((s) => {
                const pct = Math.round((s.plays / Math.max(1, d.sources[0].plays)) * 100);
                return (
                  <li key={s.source}>
                    <div className="flex justify-between text-sm"><span>{s.source}</span><span className="tabular-nums text-nevoa">{formatCount(s.plays)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-lona"><div className="h-full rounded-full bg-sol" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-nevoa">Divulgue o link com ?utm_source=instagram (ou whatsapp, tiktok) para ver cada rede aqui.</p>}

          <h2 className="mb-3 mt-8 font-display text-xl font-bold">Seus maiores fãs</h2>
          {d.top_fans.length ? (
            <ol className="space-y-1">
              {d.top_fans.map((f, i) => (
                <li key={f.user_id} className="flex items-center gap-3">
                  <span className="w-5 text-right font-display font-bold text-sol">{i + 1}</span>
                  <Link href={`/perfil/${f.username}`} className="flex-1 truncate hover:text-sol">{f.display_name || f.username}</Link>
                  <span className="text-sm text-nevoa">{levelInfo(f.xp).name}, {f.xp} pts</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-nevoa">Ninguém pontuou com você ainda.</p>}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-bold">Lançamentos</h2>
        {rels.length ? (
          <ul className="divide-y divide-lona">
            {rels.map((r) => {
              const ready = r.tracks.filter((t) => t.status === 'ready').length;
              const failed = r.tracks.filter((t) => t.status === 'error').length;
              const scheduled = r.status === 'ready' && new Date(r.publish_at) > new Date();
              const st = scheduled ? { text: `Agendado para ${new Date(r.publish_at).toLocaleDateString('pt-BR')}`, cls: 'bg-palco text-luar' } : statusLabel[r.status];
              return (
                <li key={r.id} className="flex items-center gap-4 py-3">
                  <div className="w-14 shrink-0"><Cover path={r.cover_path} title={r.title} className="!rounded-lg" /></div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/${artist.slug}/${r.slug}`} className="block truncate font-semibold hover:text-sol">{r.title}</Link>
                    <span className="text-sm text-nevoa">
                      {kindLabel[r.kind]}, {ready} de {r.tracks.length} faixas prontas{failed ? `, ${failed} com erro` : ''}
                    </span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-nevoa">Nenhum lançamento ainda. Publique seu primeiro CD para aparecer na página inicial.</p>
        )}
      </section>

      <section className="mt-12 max-w-xl">
        <h2 className="mb-4 font-display text-xl font-bold">Perfil público</h2>
        <ArtistSettings artist={artist} />
      </section>
    </>
  );
}
