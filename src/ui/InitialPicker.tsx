/** 헷갈리는 글자는 검색에서 같게 보므로 버튼에도 함께 적는다 */
export function initialLabel(c: string): string {
  return c === '0' ? '0·O' : c === '1' ? '1·I' : c;
}

/**
 * 결과가 많을 때 "새겨진 글자의 첫 글자"로 좁히는 버튼 묶음.
 * 이미 골랐으면 고른 글자와 지우기 버튼만 보여준다.
 */
export function InitialPicker({ counts, selected, onSelect }: {
  counts: { char: string; count: number }[];
  selected: string;
  onSelect: (char: string) => void;
}) {
  if (selected) {
    return (
      <div className="initial-on">
        <span>좁힌 첫 글자</span>
        <b>{initialLabel(selected)}</b>
        <button type="button" className="initial-x" aria-label="첫 글자 지우기" onClick={() => onSelect('')}>×</button>
      </div>
    );
  }
  if (!counts.length) return null;
  return (
    <section className="initial" aria-label="첫 글자로 좁히기">
      <p className="initial-t">알약에 새겨진 <b>첫 글자</b>를 고르면 확 줄어요</p>
      <p className="initial-h">앞·뒷면 중 한쪽이라도 이 글자로 시작하는 알약만 남겨요</p>
      <div className="initial-grid">
        {counts.map(({ char, count }) => (
          <button key={char} type="button" className="initial-chip" aria-label={`${initialLabel(char)} ${count}개`} onClick={() => onSelect(char)}>
            <b>{initialLabel(char)}</b>
            <span>{count.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
