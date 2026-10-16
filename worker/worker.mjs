// Musika worker: pega faixas da fila, converte para HLS (64 e 128 kbps) e publica no volume de mídia.
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_DIR = process.env.MEDIA_DIR || '/data/media';
const IDLE_MS = 3000;

if (!SUPABASE_URL || !KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} saiu com ${code}: ${err.slice(-1500)}`))));
  });
}

async function probeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error('arquivo sem áudio válido');
  return Math.round(d * 10) / 10;
}

async function transcode(input, outDir) {
  await mkdir(outDir, { recursive: true });
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-map', '0:a:0', '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-b:a:0', '64k', '-b:a:1', '128k',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'mpegts',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', join(outDir, 'v%v', 'seg_%04d.ts'),
    '-master_pl_name', 'index.m3u8',
    '-var_stream_map', 'a:0,name:64k a:1,name:128k',
    join(outDir, 'v%v', 'stream.m3u8'),
  ]);
  // ffmpeg nomeia as pastas com o "name" do var_stream_map quando presente
  const dirs = await readdir(outDir);
  if (!dirs.includes('index.m3u8')) throw new Error('master playlist não gerada');
}

async function processJob(job) {
  const work = join(tmpdir(), `job-${job.job_id}`);
  const finalDir = join(MEDIA_DIR, 'hls', job.track_id);
  const stagingDir = join(MEDIA_DIR, 'hls', `.tmp-${job.track_id}`);
  await rm(work, { recursive: true, force: true });
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  try {
    const { data, error } = await sb.storage.from('uploads').download(job.upload_path);
    if (error) throw new Error(`download do original falhou: ${error.message}`);
    const input = join(work, 'original');
    await writeFile(input, Buffer.from(await data.arrayBuffer()));

    const duration = await probeDuration(input);
    await transcode(input, stagingDir);
    await rm(finalDir, { recursive: true, force: true });
    await rename(stagingDir, finalDir);

    const { error: e2 } = await sb.rpc('finish_transcode_job', {
      p_job: job.job_id, p_ok: true, p_duration: duration, p_hls: `${job.track_id}/index.m3u8`, p_error: null,
    });
    if (e2) throw new Error(`finish falhou: ${e2.message}`);
    console.log(`ok faixa ${job.track_id} (${duration}s)`);
  } catch (err) {
    console.error(`erro faixa ${job.track_id}:`, err.message);
    await rm(stagingDir, { recursive: true, force: true });
    await sb.rpc('finish_transcode_job', {
      p_job: job.job_id, p_ok: false, p_duration: null, p_hls: null, p_error: String(err.message).slice(0, 1000),
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(join(MEDIA_DIR, 'hls'), { recursive: true });
  console.log('musika worker pronto');
  while (!stopping) {
    try {
      const { data: job, error } = await sb.rpc('claim_transcode_job');
      if (error) { console.error('fila:', error.message); await sleep(IDLE_MS * 3); continue; }
      if (!job) { await sleep(IDLE_MS); continue; }
      await processJob(job);
    } catch (err) {
      console.error('loop:', err.message);
      await sleep(IDLE_MS * 3);
    }
  }
  console.log('worker parado');
}

main();
