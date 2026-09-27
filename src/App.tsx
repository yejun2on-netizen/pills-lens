import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Pill, PillDataset } from './types';
import { EMPTY_QUERY, indexPills, isEmptyQuery, searchPills, type IndexedPill, type PillQuery } from './lib/search';
import { SearchPanel } from './ui/SearchPanel';
import { PillCard } from './ui/PillCard';
import { PillSheet } from './ui/PillSheet';
import { Disclaimer } from './ui/Disclaimer';

type Data =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; updated: string; pills: IndexedPill[] };

const PAGE = 30;

/** 요소가 화면에 보이는지 */
function useInView(ref: React.RefObject<Element>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

export default function App() {
  const [data, setData] = useState<Data>({ state: 'loading' });
  const [query, setQuery] = useState<PillQuery>(EMPTY_QUERY);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Pill | null>(null);
  const deferred = useDeferredValue(query);
  const resultsRef = useRef<HTMLElement>(null);
  const resultsInView = useInView(resultsRef);

  useEffect(() => {
    fetch('/pills.json')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<PillDataset>; })
      .then((d) => setData({ state: 'ready', updated: d.updated, pills: indexPills(d.pills) }))
      .catch(() => setData({ state: 'error' }));
  }, []);

  const results = useMemo(() => (data.state === 'ready' ? searchPills(data.pills, deferred) : []), [data, deferred]);
  useEffect(() => setLimit(PAGE), [deferred]);

  const empty = isEmptyQuery(query);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2.6" y="8.2" width="18.8" height="7.6" rx="3.8" transform="rotate(-38 12 12)" stroke="currentColor" strokeWidth="1.7" />
              <path d="M9.6 9.1l4.8 5.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" transform="rotate(-8 12 12)" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name">알약 렌즈</span>
            <span className="brand-sub">Pill Lens</span>
          </span>
        </div>
        {data.state === 'ready' && <span className="topbar-pill">알약 {data.pills.length.toLocaleString()}종</span>}
      </header>

      <main className="main">
        <section className="hero">
          <p className="eyebrow">글자 · 모양 · 색으로 찾아요</p>
          <h1>이 알약,<br /><span className="hl">무슨 약</span>일까요?</h1>
          <p className="lead">알약에 새겨진 글자와 모양, 색을 고르면 식약처 데이터에서 같은 알약을 찾아드려요.</p>
        </section>

        {data.state === 'error' && (
          <div className="banner" role="alert">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7.5v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>알약 데이터를 불러오지 못했어요. 새로고침해 주세요.</span>
          </div>
        )}

        <SearchPanel query={query} onChange={setQuery} />

        <section className="results" ref={resultsRef} aria-live="polite">
          <div className="results-head">
            <h2>
              {data.state === 'loading' ? '알약 데이터를 불러오는 중…'
                : empty ? '조건을 골라 주세요'
                : <>찾은 알약 <b>{results.length.toLocaleString()}</b>개</>}
            </h2>
            {!empty && <button type="button" className="reset" onClick={() => setQuery(EMPTY_QUERY)}>↺ 초기화</button>}
          </div>

          {data.state === 'ready' && empty && (
            <p className="hint">글자, 모양, 색 중 하나만 골라도 찾을 수 있어요. 글자를 넣으면 가장 정확해요.</p>
          )}
          {data.state === 'ready' && !empty && results.length === 0 && (
            <p className="hint">조건에 맞는 알약이 없어요. 색은 비슷한 색(하양·회색, 노랑·주황 등)으로 바꿔 보거나 조건을 줄여 보세요.</p>
          )}

          <div className="pcards">
            {results.slice(0, limit).map((p, i) => <PillCard key={p.id} pill={p} index={i % PAGE} onOpen={setOpen} />)}
          </div>

          {results.length > limit && (
            <div className="more">
              <button type="button" className="btn btn-ghost" onClick={() => setLimit(limit + PAGE)}>
                더 보기 ({(results.length - limit).toLocaleString()}개 남음)
              </button>
            </div>
          )}
        </section>
      </main>

      {!empty && !resultsInView && results.length > 0 && (
        <button type="button" className="jump" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          찾은 알약 {results.length.toLocaleString()}개 보기 ↓
        </button>
      )}

      <Disclaimer updated={data.state === 'ready' ? data.updated : undefined} />

      {open && <PillSheet pill={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
