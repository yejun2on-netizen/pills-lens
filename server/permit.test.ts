// @vitest-environment node
import { parseCodedList, parseMaterials, toPermitInfo, fetchPermit } from './permit';
import komekina from './fixtures/permit-201706199.json';

describe('parseCodedList', () => {
  it('[코드]를 떼고 | 로 나눈다', () => {
    expect(parseCodedList('[M100390]규화미결정셀룰로오즈|[M101611]캡슐제')).toEqual(['규화미결정셀룰로오즈', '캡슐제']);
    expect(parseCodedList('')).toEqual([]);
    expect(parseCodedList(null)).toEqual([]);
  });
});

describe('parseMaterials', () => {
  it('성분마다 이름·분량·성분정보를 뽑고 총량은 첫 값을 쓴다', () => {
    const s = '총량 : 이 약 1캡슐 (315.46밀리그램) 중|성분명 : 메퀴타진|분량 : 1.33|단위 : 밀리그램|규격 : KP|성분정보 : |비고 : ;'
      + '총량 : 이 약 1캡슐 (315.46밀리그램) 중|성분명 : 밸라돈나총알카로이드|분량 : 0.13|단위 : 밀리그램|규격 : JP|성분정보 : 히오스시아민으로서 0.126밀리그램|비고 : ';
    expect(parseMaterials(s)).toEqual({
      totalContent: '이 약 1캡슐 (315.46밀리그램) 중',
      ingredients: [
        { name: '메퀴타진', amount: '1.33 밀리그램', note: '' },
        { name: '밸라돈나총알카로이드', amount: '0.13 밀리그램', note: '히오스시아민으로서 0.126밀리그램' },
      ],
    });
  });
  it('비어 있으면 빈 목록', () => {
    expect(parseMaterials('')).toEqual({ totalContent: '', ingredients: [] });
  });
});

describe('toPermitInfo', () => {
  it('실제 코메키나캡슐 응답을 화면용으로 바꾼다', () => {
    const p = toPermitInfo(komekina);
    expect(p).toMatchObject({
      seq: '201706199', name: '코메키나캡슐', company: '(주)대웅제약', otc: '일반의약품', cancel: null,
      totalContent: '이 약 1캡슐 (315.46밀리그램) 중',
      additives: ['규화미결정셀룰로오즈', '캡슐제', '스테아르산마그네슘', '유당수화물'],
      storage: '기밀용기, 실온(1~30℃)보관',
      validTerm: '제조일로부터 34 개월',
    });
    expect(p.ingredients.map((i) => i.name)).toEqual(expect.arrayContaining(['메퀴타진', '슈도에페드린염산염', '카페인무수물']));
    expect(p.dosage[0].blocks[0]).toEqual({ kind: 'text', text: '성인(15세 이상) : 1회 1캡슐씩 1일 3회, 매 식후에 복용한다.' });
    expect(p.cautions).toHaveLength(7);
  });

  it('허가 상태가 정상이 아니면 cancel에 담고, 성분표가 없으면 주성분 이름을 쓴다', () => {
    const p = toPermitInfo({ ITEM_SEQ: '1', CANCEL_NAME: '취하', MATERIAL_NAME: '', MAIN_ITEM_INGR: '[M1]가성분|[M2]나성분' });
    expect(p.cancel).toBe('취하');
    expect(p.ingredients).toEqual([{ name: '가성분', amount: '', note: '' }, { name: '나성분', amount: '', note: '' }]);
  });
});

describe('fetchPermit', () => {
  const KEY = 'secret-key-123';
  const mockFetch = (body: string, status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
  afterEach(() => vi.unstubAllGlobals());

  it('품목일련번호와 서비스키로 조회하고 결과를 변환한다', async () => {
    mockFetch(JSON.stringify({ header: { resultCode: '00' }, body: { totalCount: 1, items: [komekina] } }));
    const p = await fetchPermit('201706199', KEY);
    expect(p?.name).toBe('코메키나캡슐');
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get('item_seq')).toBe('201706199');
    expect(url.searchParams.get('serviceKey')).toBe(KEY);
  });

  it('허가정보에 없으면 null', async () => {
    mockFetch(JSON.stringify({ header: { resultCode: '00' }, body: { totalCount: 0, items: [] } }));
    expect(await fetchPermit('200808877', KEY)).toBeNull();
  });

  it('다른 품목만 오면(파라미터가 무시된 경우) 엉뚱한 약을 돌려주지 않는다', async () => {
    mockFetch(JSON.stringify({ header: { resultCode: '00' }, body: { totalCount: 42973, items: [{ ...komekina, ITEM_SEQ: '195700004' }] } }));
    expect(await fetchPermit('201706199', KEY)).toBeNull();
  });

  it('키 오류(XML 응답)는 서비스키를 드러내지 않고 실패한다', async () => {
    mockFetch('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>');
    const err = await fetchPermit('201706199', KEY).catch((e: Error) => e);
    expect(String(err)).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    expect(String(err)).not.toContain(KEY);
  });

  it('HTTP 오류와 빈 키는 실패한다', async () => {
    mockFetch('busy', 503);
    await expect(fetchPermit('201706199', KEY)).rejects.toThrow('HTTP 503');
    await expect(fetchPermit('201706199', '')).rejects.toThrow('DATA_GO_KR_SERVICE_KEY');
  });
});
