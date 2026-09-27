import { useEffect, useState } from 'react';
import type { DocArticle, DocBlock, PermitInfo, PermitResponse } from '../types';
import { fetchPermit } from '../lib/api';

function Block({ block }: { block: DocBlock }) {
  if (block.kind === 'text') return <p className="doc-p">{block.text}</p>;
  return (
    <div className="doc-table" tabIndex={0}>
      <table>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => <td key={i} colSpan={c.colSpan} rowSpan={c.rowSpan}>{c.text}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blocks({ blocks }: { blocks: DocBlock[] }) {
  return <>{blocks.map((b, i) => <Block key={i} block={b} />)}</>;
}

/** 항목 제목을 머리글로 두고 본문을 펼쳐 보여준다 (효능·용법처럼 짧은 문서). */
function FlatArticles({ articles }: { articles: DocArticle[] }) {
  return (
    <>
      {articles.map((a, i) => (
        <div className="doc-art-flat" key={i}>
          {a.title && (a.blocks.length ? <h4>{a.title}</h4> : <p className="doc-p">{a.title}</p>)}
          <Blocks blocks={a.blocks} />
        </div>
      ))}
    </>
  );
}

/** 항목마다 접었다 펼 수 있게 보여준다 (주의사항처럼 긴 문서). */
function FoldedArticles({ articles }: { articles: DocArticle[] }) {
  return (
    <>
      {articles.map((a, i) =>
        a.title && a.blocks.length ? (
          <details className="doc-art" key={i}>
            <summary>{a.title}</summary>
            <div className="doc-art-body"><Blocks blocks={a.blocks} /></div>
          </details>
        ) : (
          <div className="doc-art-flat" key={i}>
            {a.title && <p className="doc-p">{a.title}</p>}
            <Blocks blocks={a.blocks} />
          </div>
        ),
      )}
    </>
  );
}

function Section({ title, count, open, children }: { title: string; count?: number; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="doc-sec" open={open}>
      <summary>
        <span>{title}</span>
        {count !== undefined && <small>{count}개 항목</small>}
      </summary>
      <div className="doc-body">{children}</div>
    </details>
  );
}

function Permit({ p }: { p: PermitInfo }) {
  const foldedCount = p.cautions.filter((a) => a.title && a.blocks.length).length;
  return (
    <>
      {p.cancel && (
        <p className="permit-warn" role="note">
          이 약은 허가 상태가 ‘{p.cancel}’예요. 지금은 판매되지 않는 약일 수 있어요.
        </p>
      )}
      {p.efficacy.length > 0 && <Section title="효능·효과" open><FlatArticles articles={p.efficacy} /></Section>}
      {p.dosage.length > 0 && <Section title="용법·용량" open><FlatArticles articles={p.dosage} /></Section>}
      {p.cautions.length > 0 && (
        <Section title="사용상의 주의사항" count={foldedCount || undefined}>
          <FoldedArticles articles={p.cautions} />
        </Section>
      )}
      {(p.ingredients.length > 0 || p.additives.length > 0) && (
        <Section title="성분">
          {p.totalContent && <p className="doc-p doc-muted">{p.totalContent}</p>}
          {p.ingredients.length > 0 && (
            <ul className="ing-list">
              {p.ingredients.map((g, i) => (
                <li key={i}>
                  <span className="ing-name">{g.name}</span>
                  {g.amount && <span className="ing-amt">{g.amount}</span>}
                  {g.note && <span className="ing-note">{g.note}</span>}
                </li>
              ))}
            </ul>
          )}
          {p.additives.length > 0 && (
            <p className="doc-p"><b className="doc-k">첨가제</b> {p.additives.join(', ')}</p>
          )}
        </Section>
      )}
      {(p.storage || p.validTerm) && (
        <div className="info permit-store">
          {p.storage && <div className="drow"><span className="k">보관</span><span className="v">{p.storage}</span></div>}
          {p.validTerm && <div className="drow"><span className="k">사용기간</span><span className="v">{p.validTerm}</span></div>}
        </div>
      )}
      <p className="permit-src">출처: 식품의약품안전처 의약품 제품 허가정보 · 공식 문구 그대로</p>
    </>
  );
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'done'; res: PermitResponse };

/** 알약 상세 시트 안의 "약 설명" 영역. 품목일련번호로 허가정보를 불러온다. */
export function PermitView({ seq }: { seq: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetchPermit(seq, ctrl.signal)
      .then((res) => setState({ status: 'done', res }))
      .catch(() => { if (!ctrl.signal.aborted) setState({ status: 'error' }); });
    return () => ctrl.abort();
  }, [seq, attempt]);

  return (
    <section className="permit" aria-label="약 설명" aria-busy={state.status === 'loading'}>
      <h3 className="permit-h">약 설명</h3>
      {state.status === 'loading' && (
        <div className="permit-loading">
          <span>식약처 허가정보를 불러오는 중…</span>
          <i /><i /><i />
        </div>
      )}
      {state.status === 'error' && (
        <div className="permit-note">
          <p>약 설명을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setAttempt(attempt + 1)}>다시 시도</button>
        </div>
      )}
      {state.status === 'done' && !state.res.found && (
        <div className="permit-note">
          <p>식약처 허가정보에서 이 약의 설명을 찾지 못했어요. 허가가 취소됐거나 제품 정보가 바뀐 약일 수 있어요. 아래 의약품안전나라에서 확인해 보세요.</p>
        </div>
      )}
      {state.status === 'done' && state.res.found && <Permit p={state.res.permit} />}
    </section>
  );
}
