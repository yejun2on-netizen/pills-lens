import type { PhotoGuess, Pill, PillForm, ScoreLine } from '../types';
import { normalizeImprint } from './pillData';

export interface PillQuery {
  /** 새겨진 글자 또는 제품명 */
  text: string;
  shapes: string[];
  colors: string[];
  forms: PillForm[];
  lines: ScoreLine[];
  /** 사진 판독처럼 확실하지 않은 조건. 거르지 않고 맞는 알약을 앞으로만 당긴다. */
  prefer?: Preference;
}

export interface Preference {
  shapes: string[];
  forms: PillForm[];
  colors: string[];
}

export const EMPTY_QUERY: PillQuery = { text: '', shapes: [], colors: [], forms: [], lines: [] };

/** 검색용 정규화 값을 미리 계산해 둔 알약. nf/nb: 앞/뒤 식별문자, nn: 제품명 */
export interface IndexedPill extends Pill {
  nf: string;
  nb: string;
  nn: string;
}

function normalizeName(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '');
}

/**
 * 눈으로도, 사진 판독으로도 자주 헷갈리는 글자를 같게 본다 (O↔0, I↔1).
 * 사진 시험에서 "ZO2"를 "Z02"로 읽은 경우가 있었다.
 */
function foldImprint(s: string): string {
  return normalizeImprint(s).replace(/O/g, '0').replace(/I/g, '1');
}

export function indexPills(pills: Pill[]): IndexedPill[] {
  return pills.map((p) => ({ ...p, nf: foldImprint(p.front), nb: foldImprint(p.back), nn: normalizeName(p.name) }));
}

export function isEmptyQuery(q: PillQuery): boolean {
  return !q.text.trim() && !q.shapes.length && !q.colors.length && !q.forms.length && !q.lines.length;
}

/** 입력한 식별문자를 공백 기준 토큰으로 나눈다. "YH LT" → ["YH", "LT"] */
export function imprintTokens(input: string): string[] {
  return input.split(/\s+/).map(foldImprint).filter(Boolean);
}

/**
 * 토큰 하나가 알약 앞/뒤 글자와 얼마나 맞는지. 낮을수록 잘 맞음, 안 맞으면 -1.
 * 앞뒤를 붙여 쓴 경우(YH + LT → "YHLT")도 찾는다.
 */
function tokenRank(token: string, p: IndexedPill): number {
  if (token === p.nf || token === p.nb) return 0;
  if (p.nf.startsWith(token) || p.nb.startsWith(token)) return 1;
  if (p.nf.includes(token) || p.nb.includes(token)) return 2;
  if ((p.nf + p.nb).includes(token) || (p.nb + p.nf).includes(token)) return 3;
  return -1;
}

/** 식별문자 점수. 모든 토큰이 맞아야 하며, 하나라도 안 맞으면 -1 */
function imprintScore(tokens: string[], p: IndexedPill): number {
  if (!tokens.length) return -1;
  let score = 0;
  for (const t of tokens) {
    const r = tokenRank(t, p);
    if (r < 0) return -1;
    score += r;
  }
  return score;
}

/** 제품명 점수. 모든 단어가 이름에 있어야 하며, 이름이 첫 단어로 시작하면 더 앞에 둔다. */
function nameScore(words: string[], p: IndexedPill): number {
  if (!words.length || !words.every((w) => p.nn.includes(w))) return -1;
  return p.nn.startsWith(words[0]) ? 0 : 1;
}

/** 글자 검색에서 식별문자 일치를 제품명 일치보다 앞에 두기 위한 간격 */
const NAME_OFFSET = 100;

/**
 * 사람도 AI도 자주 헷갈리는 모양 묶음.
 * 실제 촬영 사진 평가에서 AI의 모양 오답 22건이 모두 장방형을 타원형으로 본 것이었다.
 */
const SIMILAR_SHAPES = [['장방형', '타원형']];

export function similarShapes(shape: string): string[] {
  return SIMILAR_SHAPES.find((g) => g.includes(shape)) ?? [shape];
}

/**
 * 선호 조건에 안 맞을 때 더하는 점수 (낮을수록 앞). 식별문자 점수(정확 0 · 앞부분 1 · 포함 2)와 같은 눈금이라,
 * 글자가 똑같은 알약끼리는 모양·제형·색이 맞는 쪽이 앞선다.
 */
function preferencePenalty(p: IndexedPill, pref: Preference): number {
  let s = 0;
  if (pref.shapes.length && !pref.shapes.includes(p.shape)) {
    s += pref.shapes.some((x) => similarShapes(x).includes(p.shape)) ? 1 : 2;
  }
  if (pref.forms.length && !pref.forms.includes(p.form)) s += 2;
  if (pref.colors.length && !pref.colors.some((c) => p.colors.includes(c))) s += 1;
  return s;
}

/**
 * 조건에 맞는 알약을 잘 맞는 순서로 돌려준다.
 * - 글자: 앞/뒤 식별문자에 맞거나, 제품명에 들어 있으면 통과 (식별문자 일치가 먼저)
 * - 모양·제형·분할선: 고른 것 중 하나라도 맞으면 통과
 * - 색상: 고른 색을 모두 가진 알약만 (두 가지 색 캡슐을 좁히기 위해)
 * - prefer(선호): 거르지 않고 순서에만 반영
 */
export function searchPills(pills: IndexedPill[], q: PillQuery): IndexedPill[] {
  if (isEmptyQuery(q)) return [];
  const tokens = imprintTokens(q.text);
  const words = q.text.split(/\s+/).map(normalizeName).filter(Boolean);
  const hasText = words.length > 0;
  const scored: { p: IndexedPill; score: number }[] = [];

  for (const p of pills) {
    if (q.shapes.length && !q.shapes.includes(p.shape)) continue;
    if (q.forms.length && !q.forms.includes(p.form)) continue;
    if (q.lines.length && !q.lines.includes(p.line)) continue;
    if (q.colors.length && !q.colors.every((c) => p.colors.includes(c))) continue;

    let score = 0;
    if (hasText) {
      const imp = imprintScore(tokens, p);
      if (imp >= 0) score = imp;
      else {
        const nm = nameScore(words, p);
        if (nm < 0) continue;
        score = NAME_OFFSET + nm;
      }
    }
    if (q.prefer) score += preferencePenalty(p, q.prefer);
    scored.push({ p, score });
  }

  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name, 'ko'));
  return scored.map((s) => s.p);
}

/**
 * 사진 판독 결과로 검색 조건을 만든다.
 * - 글자를 읽었으면 **글자로만 거르고**, 모양·제형·색은 순서에만 반영한다(prefer).
 *   실제 촬영 사진 평가에서 모양을 잘못 읽어(장방형→타원형) 맞는 알약이 걸러지는 일이 많았고,
 *   색은 이름이 데이터와 자주 달라 거르는 조건으로 쓸 수 없다.
 * - 글자가 없거나 읽은 글자로 결과가 없으면, 모양(비슷한 모양 포함)·제형으로 거른다. 이때 relaxed.
 */
export function queryFromGuess(pills: IndexedPill[], g: PhotoGuess): { query: PillQuery; relaxed: boolean } {
  const prefer: Preference = { shapes: g.shape ? [g.shape] : [], forms: g.form ? [g.form] : [], colors: g.colors };
  const byText: PillQuery = { ...EMPTY_QUERY, text: g.text, prefer };
  if (g.text && searchPills(pills, byText).length > 0) return { query: byText, relaxed: false };

  const byLook: PillQuery = { ...EMPTY_QUERY, shapes: g.shape ? similarShapes(g.shape) : [], forms: g.form ? [g.form] : [], prefer };
  if (!isEmptyQuery(byLook) && searchPills(pills, byLook).length > 0) return { query: byLook, relaxed: !!g.text };
  return { query: g.text ? byText : byLook, relaxed: false };
}
