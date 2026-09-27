import { parseCsv } from './csv';
import { parseColors, toForm, deriveLine, normalizeImprint, displayImprint, rowToPill } from './pillData';

describe('parseCsv', () => {
  it('BOM·CRLF·빈 줄을 걷어내고 한 줄을 한 레코드로 읽는다', () => {
    expect(parseCsv('﻿a,b,c\r\n1,2,\r\n\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', ''],
    ]);
  });
  it('값 안의 짝 안 맞는 따옴표가 다음 줄들을 삼키지 않는다 (식약처 CSV 실제 사례)', () => {
    const csv = [
      'seq,name,chart',
      '200709387,케티맥스정,한면에“SZ"와다른한면에”231“이새겨진정제',
      '201706199,코메키나캡슐,상부주황색|하부미황색의경질캡슐제',
      '200807091,시알리스정,"C5"가음각된정제',
    ].join('\n');
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows[1][2]).toBe('한면에“SZ"와다른한면에”231“이새겨진정제');
    expect(rows[2][1]).toBe('코메키나캡슐');
    expect(rows[3][2]).toBe('"C5"가음각된정제');
  });
});

describe('parseColors', () => {
  it('앞/뒤 색을 합치고 "-"와 진한/옅은 수식어는 뺀다', () => {
    expect(parseColors('빨강|투명', '-')).toEqual(['빨강', '투명']);
    expect(parseColors('분홍|진한', '하양')).toEqual(['분홍', '하양']);
    expect(parseColors('하양', '하양')).toEqual(['하양']);
  });
});

describe('toForm', () => {
  it('제형코드명을 4분류로 묶는다', () => {
    expect(toForm('필름코팅정')).toBe('정제');
    expect(toForm('경질캡슐제|산제')).toBe('경질캡슐');
    expect(toForm('연질캡슐제|액상')).toBe('연질캡슐');
    expect(toForm('스팬슐')).toBe('경질캡슐');
    expect(toForm('구강붕해필름')).toBe('기타');
  });
  it('제형코드명이 없으면 성상으로 추정한다', () => {
    expect(toForm('-', '흰색의 원형 정제')).toBe('정제');
  });
});

describe('deriveLine', () => {
  it('식별문자 글자 속 "분할선"을 일자 분할선으로 본다', () => {
    expect(deriveLine('V분할선T', 'HS8', '', '')).toBe('일자');
    expect(deriveLine('KD', '분할선', '', '')).toBe('일자');
  });
  it('십자분할선이나 분할선 칸의 +는 십자', () => {
    expect(deriveLine('십자분할선', 'NV', '', '')).toBe('십자');
    expect(deriveLine('YJ', '', '', '+')).toBe('십자');
  });
  it('분할선 칸이 기타면 기타, 아무 표시도 없으면 없음', () => {
    expect(deriveLine('마크', '분할선분할선', '', '기타')).toBe('기타');
    expect(deriveLine('YH', 'LT', '', '')).toBe('없음');
  });
});

describe('normalizeImprint / displayImprint', () => {
  it('기호와 분할선·마크 표기를 지워 비교 가능하게 만든다', () => {
    expect(normalizeImprint('D-W')).toBe('DW');
    expect(normalizeImprint('d.w')).toBe('DW');
    expect(normalizeImprint('V분할선T')).toBe('VT');
    expect(normalizeImprint('마크NVT')).toBe('NVT');
    expect(normalizeImprint('ID·5')).toBe('ID5');
  });
  it('표시용으로는 분할선을 | 로, 마크를 (마크)로 보여준다', () => {
    expect(displayImprint('V분할선T')).toBe('V | T');
    expect(displayImprint('마크NVT')).toBe('(마크) NVT');
    expect(displayImprint('분할선')).toBe('분할선');
    expect(displayImprint('')).toBe('');
  });
});

describe('rowToPill', () => {
  const row = {
    품목일련번호: '200808877', 품목명: '페라트라정2.5밀리그램(레트로졸)', 업소명: '(주)유한양행',
    성상: '어두운황색의원형필름코팅정', 큰제품이미지: 'https://example.com/a.jpg',
    표시앞: 'YH', 표시뒤: 'LT', 의약품제형: '원형', 색상앞: '노랑', 색상뒤: '-',
    분할선앞: '-', 분할선뒤: '-', 크기장축: '6.1', 크기단축: '6.1', 크기두께: '3.5',
    분류명: '항악성종양제', 전문일반구분: '전문의약품', 제형코드명: '필름코팅정',
  };
  it('CSV 한 줄을 Pill로 바꾼다', () => {
    expect(rowToPill(row)).toEqual({
      id: '200808877', seq: '200808877', name: '페라트라정2.5밀리그램(레트로졸)', company: '(주)유한양행',
      image: 'https://example.com/a.jpg', front: 'YH', back: 'LT', shape: '원형', colors: ['노랑'],
      line: '없음', form: '정제', formName: '필름코팅정', otc: '전문의약품', className: '항악성종양제',
      chart: '어두운황색의원형필름코팅정', size: [6.1, 6.1, 3.5],
    });
  });
  it('품목일련번호나 품목명이 없으면 null', () => {
    expect(rowToPill({ ...row, 품목일련번호: '' })).toBeNull();
    expect(rowToPill({ ...row, 품목명: '-' })).toBeNull();
  });
  it('크기 값이 비정상이면 size는 null', () => {
    expect(rowToPill({ ...row, 크기두께: '-' })!.size).toBeNull();
  });
});
