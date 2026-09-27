/**
 * 식약처 의약품안전나라의 "의약품 낱알식별 정보" CSV를 받아 public/pills.json 으로 만든다.
 * API 키가 필요 없다. 오프라인이면 받아 둔 CSV 경로를 인자로 넘기면 된다.
 *
 *   npm run data                 # 최신본 다운로드
 *   npm run data -- ./tablet.csv # 로컬 파일 사용
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseCsv } from '../src/lib/csv';
import { rowToPill } from '../src/lib/pillData';
import type { Pill, PillDataset } from '../src/types';

const SOURCE_URL = 'https://nedrug.mfds.go.kr/cmn/xls/downc/OpenData_PotOpenTabletIdntfc';
const OUT = new URL('../public/pills.json', import.meta.url);

async function loadCsv(): Promise<string> {
  const local = process.argv[2];
  if (local) return readFile(local, 'utf8');
  console.log(`다운로드: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('품목일련번호')) throw new Error('CSV가 아닌 응답을 받았어요 (사이트 오류 페이지일 수 있음)');
  return text;
}

const [header, ...rows] = parseCsv(await loadCsv());
const pills: Pill[] = [];
const perSeq = new Map<string, number>();
let skipped = 0;
for (const cells of rows) {
  // 값 안에 쉼표가 섞이면 칸이 밀리므로, 칸 수가 헤더와 다른 줄은 버린다.
  if (cells.length !== header.length) { skipped++; continue; }
  const pill = rowToPill(Object.fromEntries(header.map((h, i) => [h, cells[i]])));
  if (!pill) { skipped++; continue; }
  // 같은 품목의 다른 함량 알약은 seq가 같으므로 id에 순번을 붙인다.
  const n = perSeq.get(pill.seq) ?? 0;
  perSeq.set(pill.seq, n + 1);
  if (n > 0) pill.id = `${pill.seq}-${n}`;
  pills.push(pill);
}
// 형식이 바뀌어 대량으로 누락되면 조용히 넘어가지 말고 멈춘다.
if (skipped > rows.length * 0.01) {
  throw new Error(`읽지 못한 줄이 너무 많아요: ${skipped} / ${rows.length}. CSV 형식이 바뀌었는지 확인하세요.`);
}

const dataset: PillDataset = {
  updated: new Date().toISOString().slice(0, 10),
  count: pills.length,
  pills,
};
await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(dataset));
console.log(`원본 ${rows.length}줄 → 알약 ${pills.length}개 저장 (건너뜀 ${skipped}) → public/pills.json`);
