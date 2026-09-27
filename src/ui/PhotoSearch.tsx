import type { PhotoGuess } from '../types';

export type PhotoState =
  | { status: 'idle' }
  | { status: 'reading'; preview: string }
  | { status: 'done'; preview: string; guess: PhotoGuess; relaxed: boolean }
  | { status: 'error'; preview?: string; message: string };

function Camera() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.74-1.1A1 1 0 0 1 9.1 4h5.8a1 1 0 0 1 .83.45l.74 1.1a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z"
        stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.4" stroke="#fff" strokeWidth="1.7" />
    </svg>
  );
}

function Read({ guess, relaxed, onAddColors }: { guess: PhotoGuess; relaxed: boolean; onAddColors: () => void }) {
  const items = [
    guess.text && ['글자', guess.text],
    guess.shape && ['모양', guess.shape],
    guess.form && ['제형', guess.form],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="photo-read">
      <p className="photo-read-t">사진에서 읽은 내용으로 찾았어요</p>
      <div className="photo-tags">
        {items.map(([k, v]) => <span key={k} className="photo-tag"><em>{k}</em>{v}</span>)}
      </div>
      {relaxed && <p className="photo-note">읽은 조건 그대로는 맞는 알약이 없어서 조건 일부를 뺐어요.</p>}
      {guess.colors.length > 0 && (
        <p className="photo-note">
          AI가 본 색은 <b>{guess.colors.join('·')}</b>이에요. 색 이름은 데이터와 다를 수 있어 조건에 넣지 않았어요.
          <button type="button" className="linkish" onClick={onAddColors}>색도 조건에 넣기</button>
        </p>
      )}
      <p className="photo-note">틀린 부분은 아래에서 바로 고칠 수 있어요.</p>
    </div>
  );
}

/** "사진으로 찾기" 버튼과 판독 결과 카드 */
export function PhotoSearch({ state, onPhoto, onAddColors }: {
  state: PhotoState;
  onPhoto: (file: File) => void;
  onAddColors: () => void;
}) {
  const reading = state.status === 'reading';
  const preview = state.status === 'idle' ? undefined : state.preview;
  return (
    <div className="photo">
      <label className={`scan${reading ? ' scan-busy' : ''}`} aria-busy={reading}>
        <div className="scan-row">
          <span className="scan-ic"><Camera /></span>
          <span className="scan-tt">
            <b>{reading ? '사진을 읽는 중…' : state.status === 'idle' ? '알약 사진으로 찾기' : '다른 사진으로 다시 찾기'}</b>
            <span>{reading ? '글자와 모양을 알아보고 있어요' : '글자가 보이게 가까이 찍으면 조건을 자동으로 채워요'}</span>
          </span>
          {reading && <span className="dots" aria-hidden><i /><i /><i /></span>}
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={reading}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onPhoto(f);
          }}
        />
      </label>

      {(preview || state.status === 'error') && (
        <div className={`photo-card${state.status === 'error' ? ' photo-card-err' : ''}`}>
          {preview && <img className="photo-thumb" src={preview} alt="찍은 알약 사진" />}
          {state.status === 'done' && <Read guess={state.guess} relaxed={state.relaxed} onAddColors={onAddColors} />}
          {state.status === 'error' && <p className="photo-err" role="alert">{state.message}</p>}
          {reading && <p className="photo-note">보통 2~5초 걸려요.</p>}
        </div>
      )}
      <p className="photo-privacy">사진은 알약을 알아보는 데만 쓰고 저장하지 않아요 (Google AI로 분석).</p>
    </div>
  );
}
