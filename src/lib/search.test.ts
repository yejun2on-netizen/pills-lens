import type { Pill } from '../types';
import { indexPills, searchPills, imprintTokens, EMPTY_QUERY } from './search';

function pill(over: Partial<Pill>): Pill {
  return {
    id: over.seq ?? '1', seq: '1', name: '테스트정', company: '', image: '', front: '', back: '', shape: '원형',
    colors: ['하양'], line: '없음', form: '정제', formName: '', otc: '', className: '', chart: '', size: null,
    ...over,
  };
}

const pills = indexPills([
  pill({ seq: 'a', name: '가정', front: 'YH', back: 'LT', colors: ['노랑'] }),
  pill({ seq: 'b', name: '나정', front: 'YHC', back: '', colors: ['하양'] }),
  pill({ seq: 'c', name: '다캡슐', front: 'D-W', back: '', shape: '장방형', form: '경질캡슐', colors: ['빨강', '하양'] }),
  pill({ seq: 'd', name: '라정', front: 'V분할선T', back: 'HS8', line: '일자' }),
  pill({ seq: 'e', name: '마정', front: 'AYH', back: '', colors: ['하양'] }),
]);
const seqs = (q: Partial<typeof EMPTY_QUERY>) => searchPills(pills, { ...EMPTY_QUERY, ...q }).map((p) => p.seq);

describe('searchPills', () => {
  it('조건이 하나도 없으면 결과를 내지 않는다', () => {
    expect(seqs({})).toEqual([]);
    expect(seqs({ text: '   ' })).toEqual([]);
  });

  it('식별문자는 정확히 같음 > 앞부분 일치 > 포함 순으로 정렬한다', () => {
    expect(seqs({ text: 'yh' })).toEqual(['a', 'b', 'e']);
  });

  it('기호가 달라도 같은 식별문자로 찾는다', () => {
    expect(seqs({ text: 'DW' })).toEqual(['c']);
    expect(seqs({ text: 'd.w' })).toEqual(['c']);
  });

  it('앞뒤 글자를 나눠 쓰거나 붙여 써도 찾는다', () => {
    expect(seqs({ text: 'YH LT' })).toEqual(['a']);
    expect(seqs({ text: 'YHLT' })).toEqual(['a']);
  });

  it('분할선 표기를 빼고 비교한다', () => {
    expect(seqs({ text: 'VT' })).toEqual(['d']);
  });

  it('모양·제형·분할선은 고른 것 중 하나라도 맞으면 통과', () => {
    expect(seqs({ shapes: ['장방형'] })).toEqual(['c']);
    expect(seqs({ forms: ['경질캡슐', '연질캡슐'] })).toEqual(['c']);
    expect(seqs({ lines: ['일자'] })).toEqual(['d']);
  });

  it('색상은 고른 색을 모두 가진 알약만 남긴다', () => {
    expect(seqs({ colors: ['빨강', '하양'] })).toEqual(['c']);
    expect(seqs({ colors: ['하양'] })).toEqual(['b', 'c', 'd', 'e']);
  });

  it('여러 조건은 모두 만족해야 한다', () => {
    expect(seqs({ text: 'YH', colors: ['하양'] })).toEqual(['b', 'e']);
  });
});

describe('searchPills — 제품명', () => {
  const named = indexPills([
    pill({ seq: 'k', name: '코메키나캡슐', front: 'MQTDW', form: '경질캡슐', colors: ['주황', '노랑'] }),
    pill({ seq: 't5', name: '타이레놀정500밀리그람(아세트아미노펜)', front: 'TYLENOL' }),
    pill({ seq: 't8', name: '타이레놀8시간이알서방정(아세트아미노펜)', front: 'TY' }),
    pill({ seq: 'x', name: '어린이타이레놀', front: 'KC' }),
    pill({ seq: 'm', name: '다른정', front: '타이레놀' }),
  ]);
  const find = (q: Partial<typeof EMPTY_QUERY>) => searchPills(named, { ...EMPTY_QUERY, ...q }).map((p) => p.seq);

  it('제품명 일부로 찾는다 (코메키나)', () => {
    expect(find({ text: '코메키나' })).toEqual(['k']);
  });

  it('식별문자 일치가 먼저, 그다음 이름이 그 단어로 시작하는 약, 그다음 이름에 포함된 약', () => {
    expect(find({ text: '타이레놀' })).toEqual(['m', 't8', 't5', 'x']);
  });

  it('여러 단어는 모두 이름에 있어야 한다', () => {
    expect(find({ text: '타이레놀 500' })).toEqual(['t5']);
  });

  it('이름 검색도 다른 조건과 함께 걸린다', () => {
    expect(find({ text: '코메키나', forms: ['정제'] })).toEqual([]);
  });
});

describe('imprintTokens', () => {
  it('공백으로 나누고 정규화하며 빈 토큰은 버린다', () => {
    expect(imprintTokens(' yh  l-t ')).toEqual(['YH', 'LT']);
  });
});
