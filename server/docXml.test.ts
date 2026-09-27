// @vitest-environment node
import { decodeEntities, htmlToText, parseTable, parseDoc } from './docXml';
import komekina from './fixtures/permit-201706199.json';

describe('decodeEntities', () => {
  it('이름·10진·16진 엔티티를 푼다', () => {
    expect(decodeEntities('a&nbsp;b &lt;5&gt; &#x2022; &#183; &micro;g')).toBe('a b <5> • · µg');
  });
  it('모르는 엔티티는 그대로 둔다', () => {
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });
});

describe('htmlToText', () => {
  it('위·아래 첨자를 유니코드로 바꾼다', () => {
    expect(htmlToText('체표면적 m<sup>2</sup>, H<sub>2</sub>O, 각주<sup>1</sup>')).toBe('체표면적 m², H₂O, 각주¹');
  });
  it('바꿀 수 없는 첨자는 표시를 남긴다', () => {
    expect(htmlToText('x<sup>a</sup>')).toBe('x^(a)');
  });
  it('p·br 경계는 줄바꿈, 나머지 태그는 지운다', () => {
    expect(htmlToText(' <p>25 mg</p> <p>(1일 1회)</p> ')).toBe('25 mg\n(1일 1회)');
    expect(htmlToText('첫줄<br/>둘째<b>줄</b>')).toBe('첫줄\n둘째줄');
  });
});

describe('parseTable', () => {
  it('행·열과 colspan/rowspan을 읽는다', () => {
    const html = `<tbody>
      <tr><td>&nbsp;</td><td colspan="2"><p>제1·2주</p></td></tr>
      <tr><td rowspan="2" style="width:83px">단독요법</td><td>25 mg <p>(1일 1회)</p></td><td>50 mg</td></tr>
    </tbody>`;
    expect(parseTable(html)).toEqual([
      [{ text: '' }, { text: '제1·2주', colSpan: 2 }],
      [{ text: '단독요법', rowSpan: 2 }, { text: '25 mg\n(1일 1회)' }, { text: '50 mg' }],
    ]);
  });
});

describe('parseDoc', () => {
  it('비어 있으면 빈 배열', () => {
    expect(parseDoc('')).toEqual([]);
    expect(parseDoc(null)).toEqual([]);
  });

  it('제목만 있는 항목, 표, br 문단을 처리한다', () => {
    const xml = `<DOC title="효능효과" type="EE">
      <SECTION title="">
        <ARTICLE title="1. 고칼륨혈증, 저혈당시의 에너지 보급" />
        <ARTICLE title="2. 투여량 &gt; 10mg일 때">
          <PARAGRAPH tagName="p" textIndent="" marginLeft=""><![CDATA[본문 &lt;주의&gt;]]></PARAGRAPH>
          <PARAGRAPH tagName="br" textIndent="" marginLeft=""/>
          <PARAGRAPH tagName="table" textIndent="0" marginLeft=""><![CDATA[<tbody><tr><td>가</td><td>나</td></tr></tbody>]]></PARAGRAPH>
        </ARTICLE>
      </SECTION>
    </DOC>`;
    expect(parseDoc(xml)).toEqual([
      { title: '1. 고칼륨혈증, 저혈당시의 에너지 보급', blocks: [] },
      {
        title: '2. 투여량 > 10mg일 때',
        blocks: [
          { kind: 'text', text: '본문 <주의>' },
          { kind: 'table', rows: [[{ text: '가' }, { text: '나' }]] },
        ],
      },
    ]);
  });

  it('제목 속성 안에 날것의 > 가 있어도 항목이 깨지지 않는다', () => {
    const xml = `<DOC><SECTION title=""><ARTICLE title="용량 > 10mg"><PARAGRAPH tagName="p"><![CDATA[본문]]></PARAGRAPH></ARTICLE></SECTION></DOC>`;
    expect(parseDoc(xml)).toEqual([{ title: '용량 > 10mg', blocks: [{ kind: 'text', text: '본문' }] }]);
  });

  it('제목이 있는 SECTION은 머리 항목으로 넣는다', () => {
    const xml = `<DOC><SECTION title="소아"><ARTICLE title=""><PARAGRAPH tagName="p"><![CDATA[1일 1회]]></PARAGRAPH></ARTICLE></SECTION></DOC>`;
    expect(parseDoc(xml)).toEqual([
      { title: '소아', blocks: [] },
      { title: '', blocks: [{ kind: 'text', text: '1일 1회' }] },
    ]);
  });

  it('실제 코메키나캡슐 첨부문서를 읽는다', () => {
    const ee = parseDoc(komekina.EE_DOC_DATA);
    expect(ee).toEqual([{
      title: '',
      blocks: [
        { kind: 'text', text: '코감기(급성비염), 알레르기성 비염 또는 부비강염에 의한 다음 증상의 완화' },
        { kind: 'text', text: ': 코막힘, 콧물, 재채기, 눈물, 목의 통증, 머리 무거움' },
      ],
    }]);
    const nb = parseDoc(komekina.NB_DOC_DATA);
    expect(nb.map((a) => a.title.slice(0, 5))).toEqual(['1. 경고', '2. 다음', '3. 이 ', '4. 다음', '5. 다음', '6. 기타', '7. 저장']);
    expect(nb[0].blocks[0]).toMatchObject({ kind: 'text', text: expect.stringContaining('급성 전신성 발진성 농포증(AGEP)') });
  });
});
