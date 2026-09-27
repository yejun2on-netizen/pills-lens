import { useEffect } from 'react';
import type { Pill } from '../types';
import { nedrugUrl } from '../lib/options';
import { Imprint } from './PillCard';
import { PermitView } from './PermitView';

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return <div className="drow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export function PillSheet({ pill, onClose }: { pill: Pill; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const size = pill.size ? `${pill.size[0]} × ${pill.size[1]} mm, 두께 ${pill.size[2]} mm` : '';
  const line = pill.line === '없음' ? '없음' : pill.line === '기타' ? '기타' : `${pill.line} 분할선`;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={pill.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <h2>{pill.name}</h2>
            <p>{pill.company} · {pill.otc}</p>
          </div>
          <button className="sheet-x" onClick={onClose} aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {pill.image && <img className="sheet-img" src={pill.image} alt={`${pill.name} 앞면과 뒷면 사진`} />}

        <div className="sheet-imprint"><Imprint pill={pill} /></div>

        <div className="info">
          <Row k="모양" v={pill.shape} />
          <Row k="색상" v={pill.colors.join(', ')} />
          <Row k="제형" v={pill.formName || pill.form} />
          <Row k="분할선" v={line} />
          <Row k="크기" v={size} />
          <Row k="성상" v={pill.chart} />
          <Row k="분류" v={pill.className} />
        </div>

        <PermitView seq={pill.seq} />

        <a className="btn btn-primary btn-block ext" href={nedrugUrl(pill.seq)} target="_blank" rel="noreferrer">
          의약품안전나라에서 자세히 보기
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className="sheet-note">모양이 같아도 다른 약일 수 있어요. 확실하지 않은 약은 먹지 말고 약사에게 확인하세요.</p>
      </div>
    </div>
  );
}
