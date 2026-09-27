import type { Ingredient, PermitInfo } from '../src/types';
import { parseDoc } from './docXml';

const ENDPOINT = 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService08/getDrugPrdtPrmsnDtlInq08';

type RawItem = Record<string, string | null | undefined>;

const str = (v: string | null | undefined) => (v ?? '').trim();

/** "[M223183]카페인무수물|[M203364]슈도에페드린염산염" → ["카페인무수물", "슈도에페드린염산염"] */
export function parseCodedList(s: string | null | undefined): string[] {
  return str(s)
    .split('|')
    .map((t) => t.replace(/^\[[^\]]*\]/, '').trim())
    .filter(Boolean);
}

/**
 * MATERIAL_NAME을 성분 목록으로 바꾼다.
 * "총량 : 이 약 1캡슐 (315.46밀리그램) 중|성분명 : 메퀴타진|분량 : 1.33|단위 : 밀리그램|규격 : KP|성분정보 : |비고 : ;총량 : …"
 */
export function parseMaterials(s: string | null | undefined): { totalContent: string; ingredients: Ingredient[] } {
  let totalContent = '';
  const ingredients: Ingredient[] = [];
  for (const part of str(s).split(';')) {
    const fields: Record<string, string> = {};
    for (const kv of part.split('|')) {
      const i = kv.indexOf(':');
      if (i > 0) fields[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    }
    if (!fields['성분명']) continue;
    totalContent ||= fields['총량'] ?? '';
    ingredients.push({
      name: fields['성분명'],
      amount: [fields['분량'], fields['단위']].filter(Boolean).join(' '),
      note: fields['성분정보'] ?? '',
    });
  }
  return { totalContent, ingredients };
}

export function toPermitInfo(item: RawItem): PermitInfo {
  const materials = parseMaterials(item.MATERIAL_NAME);
  // 성분표가 비어 있으면 주성분 이름만이라도 보여준다.
  const ingredients = materials.ingredients.length
    ? materials.ingredients
    : parseCodedList(item.MAIN_ITEM_INGR).map((name) => ({ name, amount: '', note: '' }));
  const cancel = str(item.CANCEL_NAME);
  return {
    seq: str(item.ITEM_SEQ),
    name: str(item.ITEM_NAME),
    company: str(item.ENTP_NAME),
    otc: str(item.ETC_OTC_CODE),
    cancel: cancel && cancel !== '정상' ? cancel : null,
    efficacy: parseDoc(item.EE_DOC_DATA),
    dosage: parseDoc(item.UD_DOC_DATA),
    cautions: parseDoc(item.NB_DOC_DATA),
    totalContent: materials.totalContent,
    ingredients,
    additives: parseCodedList(item.INGR_NAME),
    storage: str(item.STORAGE_METHOD),
    validTerm: str(item.VALID_TERM),
  };
}

/**
 * 품목일련번호로 허가정보를 조회한다. 허가정보에 없는 품목이면 null.
 * 오류 메시지에는 서비스키가 들어가지 않게 한다 (요청 URL을 싣지 않는다).
 */
export async function fetchPermit(seq: string, serviceKey: string): Promise<PermitInfo | null> {
  if (!serviceKey) throw new Error('DATA_GO_KR_SERVICE_KEY가 비어 있어요 (server/.env)');
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ serviceKey, type: 'json', item_seq: seq }).toString();

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`허가정보 API HTTP ${res.status}`);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // 키 오류 등은 XML로 온다 (예: SERVICE_KEY_IS_NOT_REGISTERED_ERROR)
    const code = text.match(/<returnAuthMsg>([^<]*)/)?.[1] ?? text.match(/<resultMsg>([^<]*)/)?.[1] ?? 'JSON이 아닌 응답';
    throw new Error(`허가정보 API 오류: ${code}`);
  }
  if (json.header?.resultCode !== '00') throw new Error(`허가정보 API 오류: ${json.header?.resultCode} ${json.header?.resultMsg}`);

  const items = json.body?.items;
  const list: RawItem[] = Array.isArray(items) ? items : [items?.item].flat().filter(Boolean);
  // 파라미터가 무시되면 전체 목록이 오므로, 반드시 같은 품목인지 확인한다.
  const item = list.find((i) => str(i.ITEM_SEQ) === seq);
  return item ? toPermitInfo(item) : null;
}
