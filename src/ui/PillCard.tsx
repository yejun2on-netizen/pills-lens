import type { CSSProperties } from 'react';
import type { Pill } from '../types';
import { displayImprint } from '../lib/pillData';

export function Imprint({ pill }: { pill: Pill }) {
  const f = displayImprint(pill.front);
  const b = displayImprint(pill.back);
  if (!f && !b) return <span className="imprint-none">새겨진 글자 없음</span>;
  return (
    <span className="imprint-view">
      {f && <span><em>앞</em>{f}</span>}
      {b && <span><em>뒤</em>{b}</span>}
    </span>
  );
}

export function PillCard({ pill, index, onOpen }: { pill: Pill; index: number; onOpen: (p: Pill) => void }) {
  const style = { animationDelay: `${Math.min(index, 10) * 35}ms` } as CSSProperties;
  return (
    <button type="button" className="pcard" style={style} onClick={() => onOpen(pill)}>
      <span className="pcard-img">
        {pill.image && <img src={pill.image} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className="pcard-body">
        <span className="pcard-name">{pill.name}</span>
        <span className="pcard-meta">
          <span className={`otc${pill.otc.startsWith('일반') ? ' otc-g' : ''}`}>{pill.otc.startsWith('일반') ? '일반' : '전문'}</span>
          <span className="pcard-co">{pill.company}</span>
        </span>
        <Imprint pill={pill} />
      </span>
    </button>
  );
}
