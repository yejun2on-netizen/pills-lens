import type { Pill, PillForm, ScoreLine } from '../types';

/** 원본 CSV에서 '-'는 값 없음 표시다. */
function clean(v: string | undefined): string {
  const s = (v ?? '').trim();
  return s === '-' ? '' : s;
}

const COLOR_MODIFIERS = new Set(['진한', '옅은']);

/** "빨강|투명", "분홍|진한" 같은 색상 앞/뒤 값을 색 이름 목록으로 합친다. */
export function parseColors(front: string, back: string): string[] {
  const out: string[] = [];
  for (const part of [front, back]) {
    for (const t of clean(part).split('|')) {
      const c = t.trim();
      if (c && !COLOR_MODIFIERS.has(c) && !out.includes(c)) out.push(c);
    }
  }
  return out;
}

/** 제형코드명(예: 필름코팅정, 경질캡슐제|산제)을 검색용 4분류로 묶는다. */
export function toForm(formName: string, chart = ''): PillForm {
  const s = clean(formName) || chart;
  if (/연질캡슐/.test(s)) return '연질캡슐';
  if (/캡슐|스팬슐/.test(s)) return '경질캡슐';
  if (/정/.test(s)) return '정제';
  return '기타';
}

/**
 * 분할선 종류를 판단한다. 원본의 분할선 칸은 거의 비어 있고,
 * 실제로는 표시(식별문자) 글자 안에 "분할선"/"십자분할선"으로 적혀 있다.
 */
export function deriveLine(front: string, back: string, lineFront: string, lineBack: string): ScoreLine {
  const text = front + back;
  if (lineFront === '+' || lineBack === '+' || text.includes('십자분할선')) return '십자';
  if (lineFront === '기타' || lineBack === '기타') return '기타';
  if (text.includes('분할선')) return '일자';
  return '없음';
}

const IMPRINT_WORDS = /십자분할선|분할선|마크/g;

/**
 * 식별문자 비교용 정규화: 분할선/마크 표기와 기호를 지우고 대문자로. "D-W", "D.W" → "DW"
 * 원본은 A를 그리스 문자 Λ(또는 ∧)로 적은 경우가 많다(873개, 예: ΛJ2). 지우지 않고 A로 읽는다.
 */
export function normalizeImprint(s: string): string {
  return s.replace(IMPRINT_WORDS, '').replace(/[Λ∧]/g, 'A').toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
}

/** 화면 표시용: "V분할선T" → "V | T", "마크NVT" → "(마크) NVT" */
export function displayImprint(s: string): string {
  if (!s) return '';
  if (s === '분할선' || s === '십자분할선' || s === '마크') return s;
  return s
    .replace(/십자분할선/g, ' + ')
    .replace(/분할선/g, ' | ')
    .replace(/마크/g, ' (마크) ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSize(long: string, short: string, thick: string): Pill['size'] {
  const nums = [long, short, thick].map((v) => Number(clean(v)));
  return nums.every((n) => Number.isFinite(n) && n > 0) ? (nums as [number, number, number]) : null;
}

/** CSV 헤더 → 값 레코드 한 줄을 Pill로 바꾼다. 필수값이 없으면 null. */
export function rowToPill(r: Record<string, string>): Pill | null {
  const seq = clean(r['품목일련번호']);
  const name = clean(r['품목명']);
  if (!seq || !name) return null;
  const front = clean(r['표시앞']);
  const back = clean(r['표시뒤']);
  const chart = clean(r['성상']);
  const formName = clean(r['제형코드명']);
  return {
    id: seq,
    seq,
    name,
    company: clean(r['업소명']),
    image: clean(r['큰제품이미지']),
    front,
    back,
    shape: clean(r['의약품제형']) || '기타',
    colors: parseColors(r['색상앞'], r['색상뒤']),
    line: deriveLine(front, back, clean(r['분할선앞']), clean(r['분할선뒤'])),
    form: toForm(formName, chart),
    formName,
    otc: clean(r['전문일반구분']),
    className: clean(r['분류명']),
    chart,
    size: toSize(r['크기장축'], r['크기단축'], r['크기두께']),
  };
}
