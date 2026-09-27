import type { PhotoGuess, Pill } from '../types';
import { indexPills, searchPills, imprintTokens, queryFromGuess, EMPTY_QUERY } from './search';

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

describe('searchPills — 헷갈리는 글자', () => {
  const list = indexPills([
    pill({ seq: 'z', name: '제로비정', front: 'ZO2', back: 'NU' }),
    pill({ seq: 'w', name: '듀로셉톨캡슐', front: 'WID60', form: '경질캡슐' }),
  ]);
  const find = (text: string) => searchPills(list, { ...EMPTY_QUERY, text }).map((p) => p.seq);

  it('O와 0, I와 1을 같게 본다 (사진 판독·입력 실수 대비)', () => {
    expect(find('Z02')).toEqual(['z']);
    expect(find('zo2')).toEqual(['z']);
    expect(find('W1D60')).toEqual(['w']);
  });
});

describe('queryFromGuess', () => {
  const list = indexPills([
    pill({ seq: 'k', name: '코메키나캡슐', front: 'MQTDW', shape: '장방형', form: '경질캡슐', colors: ['주황', '노랑'] }),
    pill({ seq: 'j', name: '정우보중익기탕엑스정', front: 'JW5', shape: '삼각형', colors: ['갈색'] }),
  ]);
  const g = (over: Partial<PhotoGuess>): PhotoGuess => ({ text: '', shape: '', colors: [], form: '', line: '', ...over });

  it('글자·모양·제형을 넣고 색은 넣지 않는다', () => {
    expect(queryFromGuess(list, g({ text: 'MQTDW', shape: '장방형', form: '경질캡슐', colors: ['빨강'] }))).toEqual({
      query: { ...EMPTY_QUERY, text: 'MQTDW', shapes: ['장방형'], forms: ['경질캡슐'] },
      relaxed: false,
    });
  });

  it('결과가 없으면 모양부터 풀어 준다', () => {
    const r = queryFromGuess(list, g({ text: 'JW5', shape: '원형', form: '정제' }));
    expect(r).toEqual({ query: { ...EMPTY_QUERY, text: 'JW5', forms: ['정제'] }, relaxed: true });
    expect(searchPills(list, r.query).map((p) => p.seq)).toEqual(['j']);
  });

  it('글자를 잘못 읽었으면 모양·제형만으로 찾는다', () => {
    expect(queryFromGuess(list, g({ text: 'XYZ', shape: '삼각형', form: '정제' })).query)
      .toEqual({ ...EMPTY_QUERY, shapes: ['삼각형'], forms: ['정제'] });
  });
});

describe('imprintTokens', () => {
  it('공백으로 나누고 정규화하며 빈 토큰은 버린다', () => {
    expect(imprintTokens(' yh  l-t ')).toEqual(['YH', 'LT']);
  });
});
