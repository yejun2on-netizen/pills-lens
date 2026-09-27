import type { DocArticle, DocBlock, DocCell } from '../src/types';

/*
 * 허가정보의 첨부문서(EE/UD/NB_DOC_DATA) XML을 화면용 구조로 바꾼다.
 *
 *   <DOC title="효능효과" type="EE">
 *     <SECTION title="">
 *       <ARTICLE title="1. 경고">
 *         <PARAGRAPH tagName="p"><![CDATA[본문]]></PARAGRAPH>
 *         <PARAGRAPH tagName="table"><![CDATA[<tbody><tr><td>…</td></tr></tbody>]]></PARAGRAPH>
 *         <PARAGRAPH tagName="br" />
 *       </ARTICLE>
 *     </SECTION>
 *   </DOC>
 *
 * 문구는 바꾸지 않고, HTML 태그와 엔티티만 글자로 풀어낸다.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", micro: 'µ', middot: '·',
  deg: '°', plusmn: '±', times: '×', le: '≤', ge: '≥', bull: '•', hellip: '…', ndash: '–', mdash: '—',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾' };
const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '(': '₍', ')': '₎' };

/** m<sup>2</sup> → m², 바꿀 수 없는 글자가 섞이면 ^(…) / _(…)로 남긴다. */
function script(text: string, map: Record<string, string>, mark: string): string {
  const t = text.trim();
  const chars = [...t];
  return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join('') : `${mark}(${t})`;
}

/** HTML 조각을 줄바꿈을 살린 평문으로 바꾼다. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, (_, t: string) => script(t, SUP, '^'))
      .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, (_, t: string) => script(t, SUB, '_'))
      .replace(/<br\s*\/?>|<\/?p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\r\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function spanAttr(attrs: string, name: string): number | undefined {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i'));
  const n = m ? Number(m[1]) : NaN;
  return n > 1 ? n : undefined;
}

export function parseTable(html: string): DocCell[][] {
  const rows: DocCell[][] = [];
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: DocCell[] = [];
    for (const [, attrs, inner] of tr.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      const cell: DocCell = { text: htmlToText(inner) };
      const colSpan = spanAttr(attrs, 'colspan');
      const rowSpan = spanAttr(attrs, 'rowspan');
      if (colSpan) cell.colSpan = colSpan;
      if (rowSpan) cell.rowSpan = rowSpan;
      cells.push(cell);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/**
 * <TAG a="…">본문</TAG> 또는 <TAG a="…" /> 를 [속성, 본문]으로 돌려준다.
 * 제목 속성 안에 > 가 들어 있어도 깨지지 않도록 속성을 따옴표 단위로 읽는다.
 */
function elements(tag: string, xml: string): [attrs: string, body: string][] {
  const re = new RegExp(String.raw`<${tag}((?:\s+[\w:-]+="[^"]*")*)\s*(?:\/>|>([\s\S]*?)<\/${tag}>)`, 'g');
  return [...xml.matchAll(re)].map((m) => [m[1], m[2] ?? '']);
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]).trim() : '';
}

function parseParagraphs(body: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const [attrs, inner] of elements('PARAGRAPH', body)) {
    const tagName = attr(attrs, 'tagName');
    const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? inner;
    if (tagName === 'table') {
      const rows = parseTable(cdata);
      if (rows.length) blocks.push({ kind: 'table', rows });
    } else {
      const text = htmlToText(cdata);
      if (text) blocks.push({ kind: 'text', text });
    }
  }
  return blocks;
}

/** 첨부문서 XML → 항목 목록. 비어 있거나 형식이 다르면 빈 배열. */
export function parseDoc(xml: string | null | undefined): DocArticle[] {
  if (!xml) return [];
  const articles: DocArticle[] = [];
  for (const [sectionAttrs, section] of elements('SECTION', xml)) {
    const sectionTitle = attr(sectionAttrs, 'title');
    if (sectionTitle) articles.push({ title: sectionTitle, blocks: [] });
    for (const [attrs, body] of elements('ARTICLE', section)) {
      const article = { title: attr(attrs, 'title'), blocks: parseParagraphs(body) };
      if (article.title || article.blocks.length) articles.push(article);
    }
  }
  return articles;
}
