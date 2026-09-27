/**
 * 사진 판독 정확도 평가. 사진마다 앱과 같은 과정을 거쳐 정답 알약이 몇 위에 나오는지 잰다.
 *   (1280px JPEG로 줄임 → /api/photo와 같은 판독 → 검색 조건 만들기 → 검색)
 *
 *   npm run sample:setup                 # 샘플 사진 받기 (처음 한 번)
 *   npm run eval:photos                  # 4장마다 1장 (약 230장, 몇 분)
 *   npm run eval:photos -- --every 1     # 전부 (920장)
 *   npm run eval:photos -- --models gemma-4-26b-a4b-it
 *
 * 필요: server/.env 의 GEMINI_API_KEY. 결과는 eval/results/ 에 JSON과 요약 Markdown으로 남는다.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from 'dotenv';
import sharp from 'sharp';
import { analyzePhoto, DEFAULT_MODELS } from '../server/vision';
import { parseCsv } from '../src/lib/csv';
import { imprintTokens, indexPills, queryFromGuess, searchPills } from '../src/lib/search';
import type { PhotoGuess, PillDataset } from '../src/types';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
config({ path: path.join(ROOT, 'server/.env') });

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const IMAGES = path.resolve(ROOT, arg('images', 'sample_img'));
const LABELS = path.resolve(ROOT, arg('labels', 'eval/kpic-sample-labels.csv'));
const EVERY = Math.max(1, Number(arg('every', '4')));
// 기본은 앱과 같은 모델 순서(실패 시 폴백). 한 모델만 재려면 --models 로 하나만 준다.
const MODELS = arg('models', DEFAULT_MODELS.join(',')).split(',');
const CONCURRENCY = 3;

const key = process.env.GEMINI_API_KEY ?? '';
if (!key) throw new Error('server/.env 에 GEMINI_API_KEY가 없어요');

const pills = indexPills((JSON.parse(readFileSync(path.join(ROOT, 'public/pills.json'), 'utf8')) as PillDataset).pills);
const byId = new Map(pills.map((p) => [p.id, p]));

const [header, ...rows] = parseCsv(readFileSync(LABELS, 'utf8'));
const labels = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) as Record<'folder' | 'id' | 'name' | 'confidence' | 'note', string>[];

interface Case { folder: string; file: string; side: '앞' | '뒤'; labelId: string; certain: boolean }
const cases: Case[] = [];
for (const l of labels) {
  if (!byId.has(l.id)) throw new Error(`정답 id ${l.id}(${l.name})가 pills.json에 없어요`);
  const files = readdirSync(path.join(IMAGES, l.folder)).filter((f) => f.endsWith('.png')).sort();
  // 샘플 사용설명서: 앞면 사진 다음에 뒷면 사진이 순서대로 온다.
  files.forEach((file, i) => {
    if (i % EVERY === 0) cases.push({ folder: l.folder, file, side: i < files.length / 2 ? '앞' : '뒤', labelId: l.id, certain: l.confidence === 'certain' });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function read(c: Case): Promise<{ guess?: PhotoGuess; error?: string; sec: number }> {
  const jpeg = await sharp(readFileSync(path.join(IMAGES, c.folder, c.file)))
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    try {
      return { guess: await analyzePhoto(jpeg, 'image/jpeg', key, MODELS), sec: (Date.now() - t0) / 1000 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await sleep(15_000 * (attempt + 1)); // 한도 초과(429)면 잠시 쉬었다 다시
    }
  }
  return { error: lastError, sec: 0 };
}

const joined = (s: string) => imprintTokens(s).join('');

const results: (Case & { guess?: PhotoGuess; error?: string; sec: number; rank: number; total: number; relaxed: boolean; textOk: boolean })[] = [];
console.log(`사진 ${cases.length}장 평가 (${EVERY}장마다 1장, 모델 ${MODELS.join(' → ')})`);
console.warn = () => {}; // 폴백 경고는 결과에 반영되므로 콘솔에서는 숨긴다
for (let i = 0; i < cases.length; i += CONCURRENCY) {
  const batch = await Promise.all(cases.slice(i, i + CONCURRENCY).map(async (c) => {
    const r = await read(c);
    const label = byId.get(c.labelId)!;
    if (!r.guess) return { ...c, ...r, rank: 0, total: 0, relaxed: false, textOk: false };
    const { query, relaxed } = queryFromGuess(pills, r.guess);
    const found = searchPills(pills, query);
    const text = joined(r.guess.text);
    const textOk = !!text && [joined(label.front), joined(label.back), joined(label.front) + joined(label.back)].includes(text);
    return { ...c, ...r, rank: found.findIndex((p) => p.id === c.labelId) + 1, total: found.length, relaxed, textOk };
  }));
  results.push(...batch);
  process.stdout.write(`  ${results.length}/${cases.length}\n`);
}

type R = (typeof results)[number];
function summarize(rs: R[]) {
  const n = rs.length || 1;
  const pct = (k: number) => `${Math.round((k / n) * 100)}%`;
  const within = (k: number) => rs.filter((r) => r.rank > 0 && r.rank <= k).length;
  const secs = rs.filter((r) => r.sec > 0);
  return {
    count: rs.length,
    top1: pct(within(1)),
    top5: pct(within(5)),
    top30: pct(within(30)),
    missed: pct(rs.filter((r) => r.rank === 0).length),
    textOk: pct(rs.filter((r) => r.textOk).length),
    errors: rs.filter((r) => r.error).length,
    avgSec: secs.length ? (secs.reduce((s, r) => s + r.sec, 0) / secs.length).toFixed(1) : '-',
  };
}

const certain = results.filter((r) => r.certain);
const overall = summarize(certain);
const bySide = { 앞: summarize(certain.filter((r) => r.side === '앞')), 뒤: summarize(certain.filter((r) => r.side === '뒤')) };
const byPill = labels.map((l) => ({ folder: l.folder, name: l.name, certain: l.confidence === 'certain', ...summarize(results.filter((r) => r.folder === l.folder)) }));

console.log('\n전체 (정답 확실한 품목만):', overall);
console.log('앞면/뒷면:', bySide);
console.table(byPill.map((p) => ({ 폴더: p.folder, 이름: p.name.slice(0, 14), 장수: p.count, '1위': p.top1, '5위안': p.top5, 놓침: p.missed, 글자: p.textOk, 확실: p.certain ? '' : '불확실' })));

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(ROOT, 'eval/results');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, `eval-${stamp}.json`), JSON.stringify({ models: MODELS, every: EVERY, overall, bySide, byPill, results }, null, 1));
const md = [
  `# 사진 판독 평가 ${stamp}`,
  '',
  `- 사진 ${results.length}장 (${EVERY}장마다 1장), 모델 ${MODELS.join(' → ')}`,
  `- 정답 확실 ${certain.length}장 기준`,
  '',
  '| 구분 | 장수 | 1위 | 5위 안 | 30위 안 | 못 찾음 | 글자 정확 | 평균(초) |',
  '|---|---|---|---|---|---|---|---|',
  ...([['전체', overall], ['앞면', bySide.앞], ['뒷면', bySide.뒤]] as const).map(([k, s]) => `| ${k} | ${s.count} | ${s.top1} | ${s.top5} | ${s.top30} | ${s.missed} | ${s.textOk} | ${s.avgSec} |`),
  '',
  '| 폴더 | 품목 | 장수 | 1위 | 5위 안 | 못 찾음 | 글자 정확 |',
  '|---|---|---|---|---|---|---|',
  ...byPill.map((p) => `| ${p.folder} | ${p.name}${p.certain ? '' : ' (정답 불확실)'} | ${p.count} | ${p.top1} | ${p.top5} | ${p.missed} | ${p.textOk} |`),
].join('\n');
writeFileSync(path.join(outDir, `eval-${stamp}.md`), md + '\n');
console.log(`\n결과: eval/results/eval-${stamp}.md`);
