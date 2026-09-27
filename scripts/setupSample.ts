/**
 * 사진 판독 평가용 샘플 이미지를 받아 sample_img/ 에 푼다.
 *
 *   npm run sample:setup             # 받기 (이미 있으면 건너뜀)
 *   npm run sample:setup -- --force  # 다시 풀기
 *
 * 출처: 식약처·약학정보원 「인공지능 개발을 위한 알약 이미지 데이터」 샘플 (이용허락범위 제한 없음)
 * - 22개 품목 × 사진 40장(한 품목은 80장) = 920장, 약 495MB. 용량 때문에 git에는 올리지 않는다.
 * - 원본이 .egg(알집 형식)라 반디집 콘솔 도구(bz)가 필요하다. 받은 파일은 .cache/ 에 남겨 다시 받지 않는다.
 * - 약학정보원 공지 페이지의 링크는 http라 브라우저가 막는다. 같은 서버의 https 주소를 쓴다.
 */
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readdirSync, readSync, renameSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE = 'https://liveupdate.pm2000.co.kr/sik_data/sample_img.Egg';
const SIZE = 515_454_560;
const EXPECTED_IMAGES = 920;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'sample_img');
const EGG = path.join(ROOT, '.cache', 'sample_img.Egg');
const force = process.argv.includes('--force');

function countImages(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .reduce((n, d) => n + readdirSync(path.join(dir, d.name)).filter((f) => f.endsWith('.png')).length, 0);
}

async function download(): Promise<void> {
  if (existsSync(EGG) && statSync(EGG).size === SIZE) {
    console.log(`받아 둔 파일 사용: ${path.relative(ROOT, EGG)}`);
    return;
  }
  mkdirSync(path.dirname(EGG), { recursive: true });
  console.log(`다운로드: ${SOURCE} (약 ${Math.round(SIZE / 1e6)}MB)`);
  const res = await fetch(SOURCE);
  if (!res.ok || !res.body) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const part = `${EGG}.part`;
  const file = createWriteStream(part);
  let done = 0;
  let shown = -1;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    if (!file.write(chunk)) await new Promise<void>((r) => file.once('drain', () => r()));
    done += chunk.length;
    const pct = Math.floor((done / SIZE) * 100);
    if (pct % 10 === 0 && pct !== shown) { shown = pct; process.stdout.write(`  ${pct}%\n`); }
  }
  await new Promise<void>((resolve, reject) => file.end((e?: Error | null) => (e ? reject(e) : resolve())));
  if (statSync(part).size !== SIZE) throw new Error(`크기가 달라요: ${statSync(part).size} / ${SIZE} 바이트. 다시 실행해 주세요.`);
  renameSync(part, EGG);
}

function checkHeader(): void {
  const buf = Buffer.alloc(4);
  const fd = openSync(EGG, 'r');
  readSync(fd, buf, 0, 4, 0);
  closeSync(fd);
  if (buf.toString('latin1') !== 'EGGA') throw new Error('EGG 압축 파일이 아니에요. .cache/sample_img.Egg 를 지우고 다시 실행해 주세요.');
}

/** 반디집 콘솔 도구 찾기: PATH의 bz → Windows 기본 설치 위치 */
function findBandizip(): string | null {
  const candidates = ['bz', 'C:\\Program Files\\Bandizip\\bz.exe', 'C:\\Program Files (x86)\\Bandizip\\bz.exe'];
  for (const c of candidates) {
    if (c.includes('\\') && !existsSync(c)) continue;
    const r = spawnSync(c, [], { stdio: 'ignore' });
    if (!r.error) return c;
  }
  return null;
}

function removeThumbs(dir: string): void {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) removeThumbs(p);
    else if (d.name.toLowerCase() === 'thumbs.db') rmSync(p);
  }
}

const existing = countImages(OUT);
if (existing >= EXPECTED_IMAGES && !force) {
  console.log(`이미 받아 둔 샘플이 있어요: sample_img/ (${existing}장). 다시 받으려면 --force`);
  process.exit(0);
}

await download();
checkHeader();

const bz = findBandizip();
if (!bz) {
  console.error([
    '',
    '.egg 압축을 풀 반디집(Bandizip)이 없어요.',
    '  - Windows: winget install Bandisoft.Bandizip 로 설치한 뒤 다시 실행하거나',
    `  - 반디집·알집으로 ${path.relative(ROOT, EGG)} 를 sample_img/ 폴더 안에 직접 풀어 주세요.`,
    '    (압축 안에 29002, 34342 … 폴더가 바로 들어 있어요)',
  ].join('\n'));
  process.exit(1);
}

if (force) rmSync(OUT, { recursive: true, force: true });
console.log(`압축 해제: ${bz} → sample_img/`);
const r = spawnSync(bz, ['x', '-y', `-o:${OUT}`, EGG], { stdio: ['ignore', 'ignore', 'inherit'] });
if (r.status !== 0) throw new Error(`압축 해제 실패 (exit ${r.status})`);
removeThumbs(OUT);

const count = countImages(OUT);
const folders = readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
if (count !== EXPECTED_IMAGES) throw new Error(`사진 수가 달라요: ${count} / ${EXPECTED_IMAGES}`);
console.log(`완료: sample_img/ 에 ${folders}개 품목, 사진 ${count}장. 정답표는 eval/kpic-sample-labels.csv`);
