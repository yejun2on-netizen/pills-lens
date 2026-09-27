import type { PhotoGuess, PillForm, ScoreLine } from '../src/types';
import { SHAPES, COLORS, FORMS } from '../src/lib/options';

/**
 * 알약 사진 판독. 12장 시험(2026-09-27)에서 flash-lite가 글자 10/12·모양 11/12·평균 1.9초로
 * gemma-4-26b(9/12·10/12·3.9초)보다 나아서 먼저 쓰고, 실패하면 gemma로 넘어간다.
 */
export const DEFAULT_MODELS = ['gemini-flash-lite-latest', 'gemma-4-26b-a4b-it'];

const COLOR_NAMES = COLORS.map((c) => c.name);
const LINE_VALUES: ScoreLine[] = ['없음', '일자', '십자'];

export function buildVisionPrompt(): string {
  return [
    '사진 속 알약(또는 캡슐) 1개를 식별하기 위한 정보를 뽑아라. 추측하지 말고 보이는 것만 적어라.',
    'JSON 하나만 출력하라:',
    '{"imprint": 알약 표면에 새겨지거나 인쇄된 글자·숫자를 보이는 그대로 (없거나 안 보이면 ""),',
    ` "shape": ${SHAPES.map((s) => `"${s}"`).join('|')} 중 하나 (캡슐은 "장방형", 둥근 캡슐/연질은 "타원형"),`,
    ` "colors": [${COLOR_NAMES.join(', ')}] 중 보이는 색 1~2개 (두 색 캡슐이면 두 색),`,
    ' "form": "정제"|"경질캡슐"|"연질캡슐"|"기타",',
    ' "line": "없음"|"일자"|"십자" (알약을 쪼개는 홈),',
    ' "is_pill": 사진에 알약이나 캡슐이 있으면 true}',
  ].join('\n');
}

export const EMPTY_GUESS: PhotoGuess = { text: '', shape: '', colors: [], form: '', line: '' };

/** 모델 답에서 JSON을 꺼내, 정해진 선택지 밖의 값은 버린다. */
export function parseGuess(raw: string): PhotoGuess {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) return EMPTY_GUESS;
  let o: any;
  try { o = JSON.parse(raw.slice(start, end + 1)); } catch { return EMPTY_GUESS; }
  if (o?.is_pill === false) return EMPTY_GUESS;
  const colors = (Array.isArray(o.colors) ? o.colors : [])
    .map(String)
    .filter((c: string, i: number, a: string[]) => COLOR_NAMES.includes(c) && a.indexOf(c) === i)
    .slice(0, 2);
  return {
    text: typeof o.imprint === 'string' ? o.imprint.replace(/\s+/g, ' ').trim().slice(0, 30) : '',
    shape: SHAPES.includes(o.shape) ? o.shape : '',
    colors,
    form: FORMS.includes(o.form) ? (o.form as PillForm) : '',
    line: LINE_VALUES.includes(o.line) ? (o.line as ScoreLine) : '',
  };
}

async function callModel(model: string, image: Buffer, mime: string, apiKey: string): Promise<string> {
  // gemma는 JSON 모드를 지원하지 않고, thinking을 최소로 해야 빠르다.
  const generationConfig = model.startsWith('gemma')
    ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } }
    : { responseMimeType: 'application/json' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    // 키는 URL이 아닌 헤더로 보내 오류 로그에 남지 않게 한다.
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data: image.toString('base64') } }, { text: buildVisionPrompt() }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}`);
  const json: any = await res.json();
  return (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => !p.thought)
    .map((p: any) => p.text ?? '')
    .join('');
}

/** 사진 한 장을 판독한다. 앞 모델이 실패(한도 초과·과부하 등)하면 다음 모델로 넘어간다. */
export async function analyzePhoto(image: Buffer, mime: string, apiKey: string, models = DEFAULT_MODELS): Promise<PhotoGuess> {
  if (!apiKey) throw new Error('GEMINI_API_KEY가 비어 있어요 (server/.env)');
  let lastError: unknown = new Error('no model');
  for (const model of models) {
    try {
      return parseGuess(await callModel(model, image, mime, apiKey));
    } catch (e) {
      lastError = e;
      console.warn(`[photo] ${model} 실패:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError;
}
